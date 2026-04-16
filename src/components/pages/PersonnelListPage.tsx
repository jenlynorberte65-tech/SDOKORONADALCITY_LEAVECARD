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


