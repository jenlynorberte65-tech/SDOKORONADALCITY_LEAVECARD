'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';
import {
  apiCall, getNTAccrualKey, getMandatoryLeaveKey,
  computeRowBalanceUpdates, sortRecordsByDate, classifyLeave, getRecordYear,
} from '@/lib/api';
import type { LeaveRecord } from '@/types';

interface Props { onOpenCard?: (id: string) => void; }

const now        = new Date();
const THIS_YEAR  = now.getFullYear();
const THIS_MONTH = now.getMonth();

function hasAccrualThisMonth(records: LeaveRecord[]): boolean {
  return (records ?? []).some(r => {
    if (r._conversion) return false;
    const action = (r.action ?? '').toLowerCase();
    if (!action.includes('accrual') && !action.includes('service credit')) return false;
    const dateStr = r.from || r.to || r.prd || '';
    if (!dateStr) return false;
    const d = parseDateForCheck(dateStr);
    return !!d && d.getFullYear() === THIS_YEAR && d.getMonth() === THIS_MONTH;
  });
}

function hasMandatoryThisYear(records: LeaveRecord[]): boolean {
  return (records ?? []).some(r => {
    if (r._conversion) return false;
    const C = classifyLeave(r.action || '');
    return C.isForce && getRecordYear(r) === THIS_YEAR;
  });
}

function parseDateForCheck(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr + 'T00:00:00');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [mm, , yyyy] = dateStr.split('/');
    return new Date(`${yyyy}-${mm.padStart(2, '0')}-01T00:00:00`);
  }
  const yearMatch  = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const lower    = dateStr.toLowerCase();
  const monthIdx = monthNames.findIndex(m => lower.includes(m));
  if (yearMatch && monthIdx !== -1) return new Date(parseInt(yearMatch[1]), monthIdx, 1);
  return null;
}

// ── Confirmation Modal ─────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean; title: string; message: string;
  confirmLabel: string; confirmColor?: string;
  onConfirm: () => void; onCancel: () => void;
}
function ConfirmModal({ open, title, message, confirmLabel, confirmColor = '#1a5c42', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--cd,#fff)', borderRadius:14, padding:'28px 28px 22px', maxWidth:440, width:'92%', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', fontFamily:'Inter,sans-serif' }}>
        <div style={{ fontSize:17, fontWeight:800, color:'var(--cha,#111)', marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:13, color:'var(--mu,#555)', lineHeight:1.7, marginBottom:22, whiteSpace:'pre-line' }}>{message}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'9px 20px', borderRadius:8, border:'1.5px solid var(--br,#ddd)', background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--mu,#555)' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding:'9px 22px', borderRadius:8, border:'none', background:confirmColor, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

interface PaginationProps {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}
function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding:'4px 10px', borderRadius:6,
    border:'1.5px solid var(--br)', background:'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize:13, color:'var(--cha)', lineHeight:1,
  });
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--mu)', userSelect:'none' }}>
      <span>Page {page} of {totalPages}</span>
      <button style={btnStyle(page <= 1)}         onClick={() => onChange(page - 1)} disabled={page <= 1}>›</button>
      <button style={btnStyle(page >= totalPages)} onClick={() => onChange(totalPages)} disabled={page >= totalPages}>»</button>
    </div>
  );
}

// ── Category badge style ───────────────────────────────────────────────────────
function categoryBadgeStyle(status: string): React.CSSProperties {
  const s = (status ?? '').toLowerCase();
  if (s === 'teaching')
    return { background:'#ddeeff', color:'var(--nb, #1a56db)', border:'1px solid #bfdbfe' };
  if (s === 'teaching related')
    return { background:'#ede9fe', color:'#5b21b6', border:'1px solid #ddd6fe' };
  return { background:'var(--g4,#f3f4f6)', color:'var(--g1,#374151)', border:'1px solid var(--br,#e5e7eb)' };
}

// ── Single employee card ───────────────────────────────────────────────────────
interface EmpCardProps {
  e: { id:string; surname?:string; given?:string; suffix?:string; status?:string; account_status?:string; records?:LeaveRecord[]; lastEditedAt?:string; };
  onClick: () => void;
}
function EmpCard({ e, onClick }: EmpCardProps) {
  const isInactive = e.account_status === 'inactive';
  const upd        = !isInactive && isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
  const fullName   = `${(e.surname || '').toUpperCase()}, ${e.given || ''}${e.suffix ? ' ' + e.suffix : ''}`;

  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        padding:'9px 14px', borderRadius:8,
        border:'1.5px solid var(--br,#e5e7eb)',
        background: isInactive ? 'var(--g4,#f9fafb)' : 'var(--cd,#fff)',
        cursor: isInactive ? 'default' : 'pointer',
        fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:500,
        opacity: isInactive ? 0.6 : 1,
        transition:'border-color .15s',
        textAlign:'left', width:'100%',
      }}
      onMouseEnter={ev => { if (!isInactive) (ev.currentTarget as HTMLButtonElement).style.borderColor = '#9ca3af'; }}
      onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.borderColor = 'var(--br,#e5e7eb)'; }}
    >
      {/* Category badge */}
      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700, whiteSpace:'nowrap', flexShrink:0, ...categoryBadgeStyle(e.status ?? '') }}>
        {e.status || '—'}
      </span>

      {/* Name */}
      <span style={{ fontWeight:700, color: isInactive ? '#6b7280' : 'var(--cha)', flexGrow:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {fullName}
      </span>

      {/* ID */}
      <span style={{ fontSize:10, color:'var(--mu)', fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>
        {e.id}
      </span>

      {/* Status indicator */}
      {isInactive ? (
        <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:700, background:'#f3f4f6', color:'#6b7280', flexShrink:0 }}>
          INACTIVE
        </span>
      ) : (
        <span style={{
          fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:700, flexShrink:0,
          background: upd ? '#d1fae5' : '#fee2e2',
          color:      upd ? '#065f46' : '#9b1c1c',
        }}>
          {upd ? '✅' : '⏳'}
        </span>
      )}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LeaveCardsPage({ onOpenCard }: Props) {
  const { state, dispatch } = useAppStore();
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [accrualPosting, setAccrualPosting]     = useState(false);
  const [mandatoryPosting, setMandatoryPosting] = useState(false);
  const [, forceRerender] = useState(0);

  const [modal, setModal] = useState<{
    open:boolean; title:string; message:string;
    confirmLabel:string; confirmColor:string; onConfirm:()=>void;
  }>({ open:false, title:'', message:'', confirmLabel:'', confirmColor:'#1a5c42', onConfirm:()=>{} });

  const closeModal = useCallback(() => setModal(m => ({ ...m, open:false })), []);

  // Pre-load records
  const loadedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const missing = state.db.filter(e => !loadedIdsRef.current.has(e.id) && (!e.records || e.records.length === 0));
    if (missing.length === 0) return;
    missing.forEach(e => loadedIdsRef.current.add(e.id));
    const load = async () => {
      for (const e of missing) {
        try {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok && res.records) dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records:res.records } });
        } catch { loadedIdsRef.current.delete(e.id); }
      }
    };
    load();
  }, [state.db.length, dispatch]);

  const monthLabel   = currentMonthLabel();
  const accrualKey   = getNTAccrualKey();
  const mandatoryKey = getMandatoryLeaveKey();
  const currentYear  = THIS_YEAR;
  const isDecember   = true; // TODO: revert → new Date().getMonth() === 11

  const ntTrActive = useMemo(() =>
    state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    }),
  [state.db]);

  const accrualPending   = useMemo(() => ntTrActive.filter(e => !hasAccrualThisMonth(e.records ?? [])), [ntTrActive]);
  const accrualAllDone   = accrualPending.length === 0 && ntTrActive.length > 0;
  const allActive        = useMemo(() => state.db.filter(e => e.account_status !== 'inactive'), [state.db]);
  const mandatoryPending = useMemo(() => allActive.filter(e => !hasMandatoryThisYear(e.records ?? [])), [allActive]);
  const mandatoryAllDone = mandatoryPending.length === 0 && allActive.length > 0;

  const accrualInfo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem(accrualKey) || 'null'); } catch { return null; }
  }, [accrualKey]);

  const mandatoryInfo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem(mandatoryKey) || 'null'); } catch { return null; }
  }, [mandatoryKey]);

  // Filtered + sorted list; reset page on search change
  const q      = search.toLowerCase();
  const sorted = useMemo(() => {
    const matches = q
      ? state.db.filter(e => `${e.id||''} ${e.surname||''} ${e.given||''} ${e.pos||''}`.toLowerCase().includes(q))
      : state.db;
    return [...matches].sort((a, b) => (a.surname||'').localeCompare(b.surname||''));
  }, [state.db, q]);

  useEffect(() => { setPage(1); }, [search]);

  // Paginate: 10 cards per page
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  // ── NT Monthly Accrual ─────────────────────────────────────────────────────
  async function runMonthlyNTAccrual() {
    const eligible = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return (cat === 'non-teaching' || cat === 'teaching related') && !hasAccrualThisMonth(e.records ?? []);
    });
    if (eligible.length === 0) { alert(`✅ All NT/TR employees already have their Monthly Accrual for ${monthLabel}.`); forceRerender(n => n + 1); return; }
    setAccrualPosting(true);
    const todayISO = new Date().toISOString().split('T')[0];
    let successCount = 0;
    const errors: string[] = [];
    for (const e of eligible) {
      try {
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) { records = res.records || []; dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records } }); }
        }
        const accrual: LeaveRecord = {
          so:'', prd:monthLabel, from:todayISO, to:todayISO,
          spec:'', action:'Monthly Accrual', earned:1.25,
          forceAmount:0, monV:0, monS:0, monDV:0, monDS:0, monAmount:0, monDisAmt:0, trV:0, trS:0,
        };
        const saveRes = await apiCall('save_record', { employee_id:e.id, record:accrual });
        if (!saveRes.ok) { errors.push(`${e.surname}, ${e.given}: ${saveRes.error||'failed'}`); continue; }
        accrual._record_id = saveRes.record_id;
        const newRecords = [...(records||[]), accrual];
        sortRecordsByDate(newRecords);
        dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records:newRecords } });
        dispatch({ type:'UPDATE_EMPLOYEE', payload:{ ...e, records:newRecords } });
        const empStatus = (e.status??'').toLowerCase() === 'teaching' ? 'Teaching' : 'Non-Teaching';
        const updates = computeRowBalanceUpdates(newRecords, e.id, empStatus);
        for (const u of updates) await apiCall('save_row_balance', u);
        successCount++;
      } catch (err) { errors.push(`${e.surname||e.id}: ${(err as Error).message||'error'}`); }
    }
    localStorage.setItem(accrualKey, JSON.stringify({ count: successCount, date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }));
    setAccrualPosting(false);
    forceRerender(n => n + 1);
    if (errors.length > 0) {
      alert(`✅ Accrual posted for ${successCount} employee(s).\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0,5).join('\n')}${errors.length>5?'\n…and more':''}`);
    } else {
      alert(`✅ Monthly accrual posted!\n\n• ${successCount} NT/TR employee(s) received 1.25 (Set A) + 1.25 (Set B)\n• Month: ${monthLabel}`);
    }
  }

  function doMonthlyNTAccrual() {
    const count = accrualPending.length;
    if (count === 0) { alert(`✅ All NT/TR employees already have their Monthly Accrual for ${monthLabel}.`); return; }
    setModal({
      open:true, title:'📈 Post Monthly NT/TR Accrual',
      message:
        `This will add 1.25 Set A + 1.25 Set B to ${count} NT/TR employee(s) who have not yet received it this month.\n\n` +
        `Month: ${monthLabel}\n\n` +
        `${accrualAllDone ? '' : `⚠️ ${ntTrActive.length - count} employee(s) already have it and will be skipped.\n\n`}` +
        `The button will remain available this month until all NT/TR employees have been posted.`,
      confirmLabel:'Post Accrual', confirmColor:'#1a5c42',
      onConfirm:() => { closeModal(); runMonthlyNTAccrual(); },
    });
  }

  // ── Mandatory Leave ────────────────────────────────────────────────────────
  async function runMandatoryLeaveDeduction() {
    const eligible = state.db.filter(e => e.account_status !== 'inactive' && !hasMandatoryThisYear(e.records ?? []));
    if (eligible.length === 0) { alert(`✅ All active employees already have Mandatory Leave for ${currentYear}.`); forceRerender(n => n + 1); return; }
    setMandatoryPosting(true);
    const todayISO = new Date().toISOString().split('T')[0];
    let successCount = 0; let skippedCount = 0;
    const skippedNames: string[] = [];
    const errors: string[] = [];
    for (const e of eligible) {
      try {
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) { records = res.records || []; dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records } }); }
        }
        if (hasMandatoryThisYear(records || [])) { skippedCount++; skippedNames.push(`${e.surname}, ${e.given}`); continue; }
        const deduction: LeaveRecord = {
          so:'', prd:`December ${currentYear}`, from:todayISO, to:todayISO,
          spec:'', action:'Mandatory Leave', earned:0, forceAmount:5,
          monV:0, monS:0, monDV:0, monDS:0, monAmount:0, monDisAmt:0, trV:0, trS:0,
        };
        const saveRes = await apiCall('save_record', { employee_id:e.id, record:deduction });
        if (!saveRes.ok) { errors.push(`${e.surname}, ${e.given}: ${saveRes.error||'failed'}`); continue; }
        deduction._record_id = saveRes.record_id;
        const newRecords = [...(records||[]), deduction];
        sortRecordsByDate(newRecords);
        dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records:newRecords } });
        dispatch({ type:'UPDATE_EMPLOYEE', payload:{ ...e, records:newRecords } });
        const empStatus = (e.status??'').toLowerCase() === 'teaching' ? 'Teaching' : 'Non-Teaching';
        const updates = computeRowBalanceUpdates(newRecords, e.id, empStatus);
        for (const u of updates) await apiCall('save_row_balance', u);
        successCount++;
      } catch (err) { errors.push(`${e.surname||e.id}: ${(err as Error).message||'error'}`); }
    }
    localStorage.setItem(mandatoryKey, JSON.stringify({ count: successCount, skipped: skippedCount, date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }));
    setMandatoryPosting(false);
    forceRerender(n => n + 1);
    let msg = `✅ Mandatory Leave deduction posted!\n\n• ${successCount} employee(s) deducted 5 days VL\n• Year: ${currentYear}`;
    if (skippedCount > 0) { msg += `\n\n⏭ Skipped ${skippedCount}:`; msg += '\n' + skippedNames.slice(0,8).join('\n'); if (skippedNames.length > 8) msg += `\n…and ${skippedNames.length-8} more`; }
    if (errors.length > 0) msg += `\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0,5).join('\n')}`;
    alert(msg);
  }

  function doMandatoryLeave() {
    if (!isDecember) return;
    const count = mandatoryPending.length;
    if (count === 0) { alert(`✅ All active employees already have Mandatory Leave for ${currentYear}.`); return; }
    const alreadyDone = allActive.length - count;
    setModal({
      open:true, title:'📅 Post Mandatory Leave Deduction',
      message:
        `This will deduct 5 days VL from ${count} employee(s) who have not yet received it this year.\n\n` +
        `• Will be deducted: ${count} employee(s)\n• Already have it (skipped): ${alreadyDone} employee(s)\n\nYear: ${currentYear}\n\n` +
        `The button will remain available in December until all active employees have been posted.`,
      confirmLabel:'Post Deduction', confirmColor:'#9b1c1c',
      onConfirm:() => { closeModal(); runMandatoryLeaveDeduction(); },
    });
  }

  const accrualDisabled   = accrualPosting || accrualAllDone;
  const mandatoryDisabled = mandatoryPosting || mandatoryAllDone || !isDecember;

  // Shared pill style
  const pillStyle = (done: boolean): React.CSSProperties => ({
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
    background: done ? '#d1fae5' : '#f3f4f6',
    color:      done ? '#065f46' : 'var(--mu)',
    border:`1px solid ${done ? '#a7f3d0' : 'var(--br)'}`,
    whiteSpace:'nowrap',
  });

  return (
    <>
      <ConfirmModal
        open={modal.open} title={modal.title} message={modal.message}
        confirmLabel={modal.confirmLabel} confirmColor={modal.confirmColor}
        onConfirm={modal.onConfirm} onCancel={closeModal}
      />

      <div className="card">
        <div className="ch grn">📋 Leave Cards</div>

        {/* ── Toolbar ── */}
        <div className="no-print" style={{ padding:'14px 16px 12px', borderBottom:'1px solid var(--dv)' }}>

          {/* Hint + search */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:14 }}>
            <span style={{ fontSize:12, color:'var(--mu)', fontWeight:500 }}>
              Click an employee to open their leave card.
            </span>
            <div className="srch">
              <span className="sri">🔍</span>
              <input
                type="text" placeholder="Search name or ID…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-start' }}>

            {/* NT Accrual */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <button
                className="btn"
                style={{
                  background: accrualDisabled ? 'var(--g4)' : 'linear-gradient(135deg,#1a5c42,#2e7d52)',
                  color:      accrualDisabled ? '#065f46'   : 'white',
                  fontWeight:700, fontSize:12, height:36, padding:'0 16px', borderRadius:8,
                  border:   accrualDisabled ? '1.5px solid #a7f3d0' : 'none',
                  opacity:  accrualDisabled ? 0.75 : 1,
                  cursor:   accrualDisabled ? 'not-allowed' : 'pointer',
                  whiteSpace:'nowrap',
                }}
                onClick={doMonthlyNTAccrual} disabled={accrualDisabled}
              >
                {accrualPosting ? '⏳ Posting…'
                  : accrualAllDone ? '✅ All NT/TR Accruals Posted'
                  : `📈 Post Monthly NT/TR Accrual (1.25 each) — ${accrualPending.length} pending`}
              </button>
              <span style={pillStyle(accrualAllDone)}>
                {accrualAllDone
                  ? `✅ All ${ntTrActive.length} NT/TR employee(s) posted for ${monthLabel}`
                  : accrualInfo
                    ? `⏳ ${accrualPending.length} of ${ntTrActive.length} still pending — last posted ${accrualInfo.date}`
                    : `⏳ ${accrualPending.length} of ${ntTrActive.length} NT/TR employee(s) pending for ${monthLabel}`}
              </span>
            </div>

            <div style={{ width:1, background:'var(--br)', alignSelf:'stretch', margin:'2px 4px' }} />

            {/* Mandatory Leave */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <button
                className="btn"
                title={
                  !isDecember ? 'Available in December only'
                    : mandatoryAllDone ? `All employees already have Mandatory Leave for ${currentYear}`
                    : `Post mandatory 5-day VL deduction for ${currentYear}`
                }
                style={{
                  background: mandatoryDisabled ? '#fef2f2' : 'linear-gradient(135deg,#7f1d1d,#b91c1c)',
                  color:      mandatoryDisabled ? '#9b1c1c' : 'white',
                  fontWeight:700, fontSize:12, height:36, padding:'0 16px', borderRadius:8,
                  border:   mandatoryDisabled ? '1.5px solid #fca5a5' : 'none',
                  opacity:  mandatoryDisabled ? 0.75 : 1,
                  cursor:   mandatoryDisabled ? 'not-allowed' : 'pointer',
                  whiteSpace:'nowrap',
                }}
                onClick={doMandatoryLeave} disabled={mandatoryDisabled}
              >
                {mandatoryPosting ? '⏳ Posting…'
                  : mandatoryAllDone ? '✅ All Mandatory Leaves Posted'
                  : !isDecember ? '📅 Post Mandatory Leave (−5 VL)'
                  : `📅 Post Mandatory Leave (−5 VL) — ${mandatoryPending.length} pending`}
              </button>
              <span style={pillStyle(mandatoryAllDone)}>
                {mandatoryAllDone
                  ? `✅ All ${allActive.length} active employee(s) posted for ${currentYear}`
                  : !isDecember ? '🔒 Available in December only'
                  : mandatoryInfo
                    ? `⏳ ${mandatoryPending.length} of ${allActive.length} still pending — last posted ${mandatoryInfo.date}`
                    : `⏳ ${mandatoryPending.length} of ${allActive.length} employee(s) pending for ${currentYear}`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Employee Card Grid ── */}
        <div id="cardsEmployeeList" style={{ padding:'12px 16px 8px' }}>
          {sorted.length === 0 ? (
            <div style={{ padding:'16px 4px', color:'var(--mu)', fontStyle:'italic', fontSize:13 }}>
              No employees found{q ? ` for "${search}"` : ''}.
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:6 }}>
                {paginated.map(e => (
                  <EmpCard key={e.id} e={e} onClick={() => onOpenCard?.(e.id)} />
                ))}
              </div>

              {/* Footer: count + pagination */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0 4px', flexWrap:'wrap', gap:8 }}>
                <span style={{ fontSize:12, color:'var(--mu)' }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} employee{sorted.length !== 1 ? 's' : ''}
                </span>
                <Pagination page={page} total={sorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
