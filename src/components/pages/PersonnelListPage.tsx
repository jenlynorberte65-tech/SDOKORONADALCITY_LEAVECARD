'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { StatBox, isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';
import RegisterModal from '@/components/modals/RegisterModal';
import CardStatusModal from '@/components/modals/CardStatusModal';
import { apiCall } from '@/lib/api';
import type { Personnel } from '@/types';

interface Props { onOpenCard: (id: string) => void; }

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
      <button style={btnStyle(page <= 1)}         onClick={() => onChange(page - 1)} disabled={page <= 1}>‹</button>
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
  e: Personnel;
  onOpenCard: (id: string) => void;
  onEdit: (e: Personnel) => void;
  isTeaching: boolean;
  upd: boolean;
  dispatch: ReturnType<typeof useAppStore>['dispatch'];
}
function EmpCard({ e, onOpenCard, onEdit, isTeaching, upd, dispatch }: EmpCardProps) {
  const isInactive = e.account_status === 'inactive';
  const fullName   = `${(e.surname || '').toUpperCase()}, ${e.given || ''}${e.suffix ? ' ' + e.suffix : ''}`;

  function handleOpenCard() {
    const page = isTeaching ? 't' : 'nt';
    dispatch({ type:'SET_CUR_ID', payload: e.id });
    dispatch({ type:'SET_PAGE',   payload: page });
    try {
      const raw = sessionStorage.getItem('deped_session');
      if (raw) {
        const s = JSON.parse(raw);
        sessionStorage.setItem('deped_session', JSON.stringify({ ...s, curId: e.id, page }));
      }
    } catch { /* ignore */ }
    onOpenCard(e.id);
  }

  return (
    <div
      style={{
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        padding:'9px 14px', borderRadius:8,
        border:'1.5px solid var(--br,#e5e7eb)',
        background: isInactive ? 'var(--g4,#f9fafb)' : 'var(--cd,#fff)',
        fontFamily:'Inter,sans-serif', fontSize:12,
        opacity: isInactive ? 0.6 : 1,
        transition:'border-color .15s',
      }}
    >
      {/* Category badge */}
      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700, whiteSpace:'nowrap', flexShrink:0, ...categoryBadgeStyle(e.status ?? '') }}>
        {e.status || '—'}
      </span>

      {/* Name — clickable to open card */}
      <button
        onClick={handleOpenCard}
        style={{
          background:'none', border:'none', padding:0, cursor:'pointer',
          fontWeight:700, color: isInactive ? '#6b7280' : 'var(--cha)',
          fontSize:12, fontFamily:'Inter,sans-serif',
          flexGrow:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis',
          whiteSpace:'nowrap', textAlign:'left',
        }}
      >
        {fullName}
      </button>

      {/* ID */}
      <span style={{ fontSize:10, color:'var(--mu)', fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>
        {e.id}
      </span>

      {/* Card status indicator */}
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

      {/* Account status */}
      <span style={{
        fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:700, flexShrink:0,
        background: isInactive ? '#fee2e2' : '#d1fae5',
        color:      isInactive ? '#9b1c1c' : '#065f46',
      }}>
        {isInactive ? '🔴 Inactive' : '🟢 Active'}
      </span>

      {/* Edit button */}
      <button
        className="btn b-amb no-print"
        style={{ height:30, padding:'0 14px', fontSize:11, flexShrink:0 }}
        onClick={() => onEdit(e)}
      >
        ✏ Edit
      </button>
    </div>
  );
}

// ── Print Row (used inside the print-only table) ───────────────────────────────
function PrintRow({ e, index, upd }: { e: Personnel; index: number; upd: boolean }) {
  const isInactive = e.account_status === 'inactive';
  const fullName   = `${(e.surname || '').toUpperCase()}, ${e.given || ''}${e.suffix ? ' ' + e.suffix : ''}`;
  return (
    <tr style={{ fontSize: 10, lineHeight: 1.4 }}>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd', textAlign:'center', color:'#555' }}>{index + 1}</td>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd', fontWeight:700 }}>{fullName}</td>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd', fontFamily:"'JetBrains Mono',monospace", fontSize:9 }}>{e.id}</td>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd' }}>{e.status || '—'}</td>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd' }}>{e.pos || '—'}</td>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd', fontSize:9 }}>{e.school || '—'}</td>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd', textAlign:'center' }}>
        {isInactive ? 'Inactive' : upd ? '✅ Updated' : '⏳ Pending'}
      </td>
      <td style={{ padding:'4px 6px', borderBottom:'1px solid #ddd', textAlign:'center' }}>
        {isInactive ? '🔴' : '🟢'}
      </td>
    </tr>
  );
}

// ── Build active filter description for print header ──────────────────────────
function buildFilterDesc(
  search: string, fCat: string, fPos: string, fSch: string, fCard: string, fAcct: string
): string {
  const parts: string[] = [];
  if (search) parts.push(`Search: "${search}"`);
  if (fCat)   parts.push(`Category: ${fCat}`);
  if (fPos)   parts.push(`Position: ${fPos}`);
  if (fSch)   parts.push(`School/Office: ${fSch}`);
  if (fCard)  parts.push(`Card Status: ${fCard === 'updated' ? 'Updated' : 'Pending'}`);
  if (fAcct)  parts.push(`Account: ${fAcct === 'active' ? 'Active' : 'Inactive'}`);
  return parts.length ? parts.join(' | ') : 'All Personnel (no filters applied)';
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PersonnelListPage({ onOpenCard }: Props) {
  const { state, dispatch } = useAppStore();
  const [search, setSearch]   = useState('');
  const [fCat, setFCat]       = useState('');
  const [fPos, setFPos]       = useState('');
  const [fSch, setFSch]       = useState('');
  const [fCard, setFCard]     = useState('');
  const [fAcct, setFAcct]     = useState('');
  const [page, setPage]       = useState(1);
  const [regOpen, setRegOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Personnel | null>(null);
  const [cardStatusOpen, setCardStatusOpen] = useState(false);

  const all        = useMemo(() => state.db, [state.db]);
  const activeOnly = useMemo(() => all.filter(e => e.account_status !== 'inactive'), [all]);

  const positions = useMemo(() => [...new Set(all.map(e => (e.pos    || '').trim().toUpperCase()).filter(Boolean))].sort(), [all]);
  const schools   = useMemo(() => [...new Set(all.map(e => (e.school || '').trim().toUpperCase()).filter(Boolean))].sort(), [all]);

  const monthLabel           = currentMonthLabel();
  const teachingCount        = all.filter(e => (e.status ?? '').toLowerCase() === 'teaching').length;
  const nonTeachingCount     = all.filter(e => (e.status ?? '').toLowerCase() === 'non-teaching').length;
  const teachingRelatedCount = all.filter(e => (e.status ?? '').toLowerCase() === 'teaching related').length;
  const updatedCount         = activeOnly.filter(e => isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt)).length;
  const notUpdatedCount      = activeOnly.length - updatedCount;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter(e => {
      if (fAcct === 'active'   && e.account_status === 'inactive') return false;
      if (fAcct === 'inactive' && e.account_status !== 'inactive') return false;
      const nm = `${e.surname || ''} ${e.given || ''} ${e.suffix || ''}`.toLowerCase();
      if (q && !`${e.id || ''} ${nm} ${e.pos || ''}`.toLowerCase().includes(q)) return false;
      if (fCat && e.status !== fCat) return false;
      if (fPos && (e.pos    || '').trim().toUpperCase() !== fPos) return false;
      if (fSch && (e.school || '').trim().toUpperCase() !== fSch) return false;
      if (fCard) {
        if (e.account_status === 'inactive') return false;
        const upd = isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
        if (fCard === 'updated' && !upd) return false;
        if (fCard === 'pending' &&  upd) return false;
      }
      return true;
    }).sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));
  }, [all, search, fCat, fPos, fSch, fCard, fAcct]);

  // Reset page on filter/search change
  useEffect(() => { setPage(1); }, [search, fCat, fPos, fSch, fCard, fAcct]);

  // Paginate
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  async function handleSaved(_emp: Personnel, isNew: boolean) {
    const res = await apiCall('get_personnel', {}, 'GET');
    if (res.ok && res.data) {
      dispatch({ type: 'SET_DB', payload: res.data });
    } else {
      if (isNew) {
        dispatch({ type: 'ADD_EMPLOYEE', payload: _emp });
      } else {
        dispatch({ type: 'UPDATE_EMPLOYEE', payload: { employee: _emp, originalId: editEmp?.id ?? _emp.id } });
      }
    }
    setRegOpen(false);
    setEditEmp(null);
  }

  function handleEdit(e: Personnel) {
    setEditEmp(e);
    setRegOpen(true);
  }

  // ── Print filtered list ────────────────────────────────────────────────────
  function handlePrintList() {
    const filterDesc = buildFilterDesc(search, fCat, fPos, fSch, fCard, fAcct);
    const printDate  = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    const rows = filtered.map((e, i) => {
      const isInactive = e.account_status === 'inactive';
      const upd = isInactive ? false : isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
      const fullName = `${(e.surname || '').toUpperCase()}, ${e.given || ''}${e.suffix ? ' ' + e.suffix : ''}`;
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${fullName}</strong></td>
          <td style="font-family:monospace;font-size:9pt">${e.id}</td>
          <td>${e.status || '—'}</td>
          <td>${e.pos || '—'}</td>
          <td>${e.school || '—'}</td>
          <td style="text-align:center">${isInactive ? 'Inactive' : upd ? '✅ Updated' : '⏳ Pending'}</td>
          <td style="text-align:center">${isInactive ? 'Inactive' : 'Active'}</td>
        </tr>`;
    }).join('');

    // Category summary counts from filtered set
    const fTeaching        = filtered.filter(e => (e.status ?? '').toLowerCase() === 'teaching').length;
    const fNonTeaching     = filtered.filter(e => (e.status ?? '').toLowerCase() === 'non-teaching').length;
    const fTeachingRelated = filtered.filter(e => (e.status ?? '').toLowerCase() === 'teaching related').length;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Personnel List — SDO Koronadal</title>
  <style>
    @page { size: A4 landscape; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #111; margin:0; }

    /* Header */
    .print-header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #1a5c42; padding-bottom: 8px; }
    .print-header .org { font-size: 8pt; color: #555; letter-spacing:.5px; text-transform:uppercase; }
    .print-header h1  { font-size: 14pt; font-weight: 800; margin: 4px 0 2px; color: #1a2e1a; }
    .print-header .sub { font-size: 9pt; color: #444; }

    /* Meta row */
    .meta-row { display:flex; justify-content:space-between; align-items:flex-start; margin:8px 0 10px; gap:12px; flex-wrap:wrap; }
    .meta-block { font-size: 8.5pt; color: #333; }
    .meta-block strong { display:block; font-size:7.5pt; text-transform:uppercase; letter-spacing:.4px; color:#777; margin-bottom:2px; }

    /* Summary chips */
    .summary { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
    .chip { padding:3px 10px; border-radius:20px; font-size:8pt; font-weight:700; border:1px solid; }
    .chip-t  { background:#ddeeff; color:#1a3a6b; border-color:#bfdbfe; }
    .chip-nt { background:#f3f4f6; color:#374151; border-color:#d1d5db; }
    .chip-tr { background:#ede9fe; color:#5b21b6; border-color:#ddd6fe; }
    .chip-total { background:#d1fae5; color:#065f46; border-color:#a7f3d0; }

    /* Table */
    table { width:100%; border-collapse:collapse; font-size:9pt; }
    thead tr th {
      background:#1a5c42; color:#fff; padding:6px 7px;
      text-align:left; font-size:8pt; font-weight:700;
      border:1px solid #134a34; white-space:nowrap;
    }
    thead tr th:first-child { text-align:center; width:32px; }
    tbody tr:nth-child(even) { background:#f7faf7; }
    tbody tr td { padding:5px 7px; border-bottom:1px solid #e5e7eb; vertical-align:middle; }
    tbody tr td:first-child { text-align:center; color:#777; font-size:8pt; }
    tbody tr:hover { background:#eefaf3; }

    /* Footer */
    .print-footer { margin-top:14px; border-top:1px solid #ccc; padding-top:7px; display:flex; justify-content:space-between; font-size:7.5pt; color:#777; }

    @media print {
      .no-print { display:none !important; }
      tbody tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="print-header">
    <div class="org">Republic of the Philippines • Department of Education • SDO City of Koronadal</div>
    <h1>Personnel Registry</h1>
    <div class="sub">Official Personnel List — Leave Management System</div>
  </div>

  <div class="meta-row">
    <div class="meta-block">
      <strong>Filter Applied</strong>
      ${filterDesc}
    </div>
    <div class="meta-block" style="text-align:right">
      <strong>Printed On</strong>
      ${printDate}
    </div>
  </div>

  <div class="summary">
    <span class="chip chip-total">👥 Total: ${filtered.length}</span>
    <span class="chip chip-t">📚 Teaching: ${fTeaching}</span>
    <span class="chip chip-nt">🏢 Non-Teaching: ${fNonTeaching}</span>
    <span class="chip chip-tr">🎓 Teaching Related: ${fTeachingRelated}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Employee ID</th>
        <th>Category</th>
        <th>Position</th>
        <th>School / Office</th>
        <th style="text-align:center">Card Status</th>
        <th style="text-align:center">Account</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="print-footer">
    <span>SDO City of Koronadal — Leave Management System</span>
    <span>Total Records: ${filtered.length} &nbsp;|&nbsp; Printed: ${printDate}</span>
  </div>

</body>
</html>`;

    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  const hasFilters = !!(search || fCat || fPos || fSch || fCard || fAcct);

  return (
    <>
      {/* ── Dashboard Stats ── */}
      <div className="stats-row no-print">
        <StatBox icon="👥"
          value={all.length}
          label="Total Personnel" />
        <StatBox icon="📚" iconClass="si-b"
          value={teachingCount}
          label="Teaching" />
        <StatBox icon="🏢" iconClass="si-a"
          value={nonTeachingCount}
          label="Non-Teaching" />
        <StatBox icon="🎓" iconClass="si-b"
          value={teachingRelatedCount}
          label="Teaching Related" />
        <StatBox icon="✅"
          iconStyle={{ background:'#d1fae5' }}
          value={updatedCount}
          label={`Updated (${monthLabel})`}
          valueStyle={{ color:'#065f46' }}
          style={{ borderColor:'var(--g3)', cursor:'pointer' }}
          onClick={() => setCardStatusOpen(true)} />
        <StatBox icon="⏳"
          iconStyle={{ background:'#fee2e2' }}
          value={notUpdatedCount}
          label="Not Yet Updated"
          valueStyle={{ color:'#c53030' }}
          style={{ borderColor:'#e53e3e', cursor:'pointer' }}
          onClick={() => setCardStatusOpen(true)} />
      </div>

      <div className="card">
        <div className="ch grn">👥 Personnel Registry</div>

        <div className="toolbar no-print">
          <div className="toolbar-left">
            <button className="btn b-grn" onClick={() => { setEditEmp(null); setRegOpen(true); }}>
              ➕ Register New Personnel
            </button>

            {/* ── Print List Button ── */}
            <button
              className="btn"
              title={hasFilters ? `Print ${filtered.length} filtered employee(s)` : `Print all ${filtered.length} employee(s)`}
              onClick={handlePrintList}
              disabled={filtered.length === 0}
              style={{
                background: filtered.length === 0 ? 'var(--g4)' : 'linear-gradient(135deg,#1a3a6b,#2563eb)',
                color: filtered.length === 0 ? '#9ca3af' : '#fff',
                fontWeight: 700, fontSize: 12, height: 36, padding: '0 16px',
                borderRadius: 8, border: 'none', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
              }}
            >
              🖨 Print List
              {hasFilters && filtered.length > 0 && (
                <span style={{
                  background:'rgba(255,255,255,0.25)', borderRadius:10,
                  padding:'1px 7px', fontSize:10, fontWeight:800,
                }}>
                  {filtered.length}
                </span>
              )}
            </button>

            <div className="srch">
              <span className="sri">🔍</span>
              <input
                type="text" placeholder="Search name or ID…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="toolbar-filters" id="toolbarFilters">
            <select className="tb-filter" value={fCat} onChange={e => setFCat(e.target.value)}>
              <option value="">All Categories</option>
              <option value="Teaching">Teaching</option>
              <option value="Non-Teaching">Non-Teaching</option>
              <option value="Teaching Related">Teaching Related</option>
            </select>
            <select className="tb-filter" value={fPos} onChange={e => setFPos(e.target.value)}>
              <option value="">All Positions</option>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="tb-filter" value={fSch} onChange={e => setFSch(e.target.value)}>
              <option value="">All Schools/Offices</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="tb-filter" value={fCard} onChange={e => setFCard(e.target.value)}>
              <option value="">All Card Status</option>
              <option value="updated">✅ Updated</option>
              <option value="pending">⏳ Pending</option>
            </select>
            <select className="tb-filter" value={fAcct} onChange={e => setFAcct(e.target.value)}>
              <option value="">All Accounts</option>
              <option value="active">🟢 Active</option>
              <option value="inactive">🔴 Inactive</option>
            </select>
            <button
              className="tb-filter-clear no-print"
              onClick={() => { setSearch(''); setFCat(''); setFPos(''); setFSch(''); setFCard(''); setFAcct(''); }}>
              ✕ Clear
            </button>
          </div>
        </div>

        {/* ── Card Grid ── */}
        <div style={{ padding:'12px 16px 8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'16px 4px', color:'var(--mu)', fontStyle:'italic', fontSize:13 }}>
              No personnel found.
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:6 }}>
                {paginated.map(e => {
                  const isTeaching = (e.status ?? '').toLowerCase() === 'teaching';
                  const isInactive = e.account_status === 'inactive';
                  const upd        = isInactive ? false : isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
                  return (
                    <EmpCard
                      key={e.id}
                      e={e}
                      onOpenCard={onOpenCard}
                      onEdit={handleEdit}
                      isTeaching={isTeaching}
                      upd={upd}
                      dispatch={dispatch}
                    />
                  );
                })}
              </div>

              {/* Footer: count + pagination */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0 4px', flexWrap:'wrap', gap:8 }}>
                <span style={{ fontSize:12, color:'var(--mu)' }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
                  {hasFilters && (
                    <span style={{ marginLeft:8, color:'var(--nb,#1a56db)', fontWeight:600 }}>
                      (filtered)
                    </span>
                  )}
                </span>
                <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>

      {regOpen && (
        <RegisterModal
          employee={editEmp}
          onClose={() => { setRegOpen(false); setEditEmp(null); }}
          onSaved={handleSaved}
        />
      )}
      {cardStatusOpen && <CardStatusModal onClose={() => setCardStatusOpen(false)} />}
    </>
  );
}
