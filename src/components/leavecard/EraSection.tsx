'use client';
import { useState } from 'react';
import { LeaveTableHeader, FwdRow, computeNTRow, computeTRow } from '@/components/leavecard/LeaveCardTable';
import { fmtD, fmtNum, hz, isEmptyRecord, apiCall } from '@/lib/api';
import type { LeaveRecord, Personnel } from '@/types';

interface Seg {
  status: string;
  recs: LeaveRecord[];
  startIdx: number;
  convIdx: number;
  conv: LeaveRecord | null;
}
interface Props {
  seg: Seg;
  si: number;
  emp: Personnel;
  isAdmin: boolean;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
  cardType: 'nt' | 't';
}

export function EraSection({ seg, si, emp, isAdmin, onRefresh, onEditRow, cardType }: Props) {
  const [open, setOpen]           = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const realRecs = seg.recs.filter(r => !r._conversion && !isEmptyRecord(r));
  const label    = `📁 ${seg.status} Leave Record — Era ${si + 1} (${seg.recs.length} entr${seg.recs.length === 1 ? 'y' : 'ies'})`;

  // ── Delete entire era ─────────────────────────────────────────
  async function handleDeleteEra() {
    const eraLabel = `Era ${si + 1} (${seg.status})`;
    const confirmed = window.confirm(
      `⚠️ Delete ${eraLabel}?\n\n` +
      `This will permanently delete ALL ${seg.recs.length} record(s) in this era, ` +
      `including the conversion marker.\n\nThis action CANNOT be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      // Collect all record_ids in this era (regular records + the conversion record)
      const ids: number[] = [];
      seg.recs.forEach(r => { if (r._record_id) ids.push(r._record_id); });
      // Also delete the conversion record that introduced this era
      if (seg.conv && seg.conv._record_id) ids.push(seg.conv._record_id);

      await Promise.all(
        ids.map(record_id =>
          apiCall('delete_record', { employee_id: emp.id, record_id })
        )
      );
      onRefresh();
    } catch (e) {
      alert('Era deletion failed: ' + String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="era-wrapper" id={`${cardType}OldEra${si > 0 ? '_' + si : ''}`}>
      {/* ── Era toggle header ── */}
      <div
        className={`era-old-toggle${open ? ' open' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="era-arrow">▼</span>
        <span>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400, color: 'var(--mu)' }}>
          Click to expand / collapse
        </span>
        {/* ── Era delete button (admin only, no-print) ── */}
        {isAdmin && (
          <button
            className="btn no-print"
            style={{
              marginLeft: 8, height: 26, padding: '0 10px', fontSize: 11,
              background: '#fee2e2', color: '#9b1c1c', border: '1px solid #fca5a5',
              borderRadius: 6, cursor: 'pointer', flexShrink: 0,
            }}
            disabled={deleting}
            onClick={e => { e.stopPropagation(); handleDeleteEra(); }}
          >
            {deleting ? '⏳' : '🗑️ Delete Era'}
          </button>
        )}
      </div>

      {/* ── Era body ── */}
      <div className={`era-old-body${open ? ' open' : ''}`}>
        <div className="card" style={{ padding: 0, margin: 0 }}>
          <div className="tw">
            <table>
              <LeaveTableHeader showAction={isAdmin} />
              <tbody>
                {cardType === 'nt' ? (
                  <NTEraRows
                    records={seg.recs}
                    isAdmin={isAdmin}
                    emp={emp}
                    startIdx={seg.startIdx}
                    onRefresh={onRefresh}
                    onEditRow={onEditRow}
                  />
                ) : (
                  <TEraRows
                    records={seg.recs}
                    isAdmin={isAdmin}
                    emp={emp}
                    startIdx={seg.startIdx}
                    onRefresh={onRefresh}
                    onEditRow={onEditRow}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  NT Era Rows
//  NOTE: bV / bS are seeded from conv.fwdBV / conv.fwdBS so
//  the first row continues from the previous era's last balance.
// ─────────────────────────────────────────────────────────────
function NTEraRows({
  records, isAdmin, emp, startIdx, onRefresh, onEditRow,
}: {
  records: LeaveRecord[];
  isAdmin: boolean;
  emp: Personnel;
  startIdx: number;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
}) {
  // Seed from forwarded balance if a conversion record exists in this segment.
  // For Teaching → Non-Teaching: Teaching has a single balance stored in fwdBV.
  // Both bV (vacation) and bS (sick) must start from that same value.
  // For Non-Teaching → Teaching: fwdBV=vacation, fwdBS=sick are already correct.
 // REPLACE:
// Era 1 old sections always start from 0 — they compute their own running balance
let bV = 0;
let bS = 0;

  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const res = computeNTRow(r, bV, bS);
        bV = res.bV; bS = res.bS;
        const { eV, eS, aV, aS, wV, wS } = res;

        const { classifyLeave } = require('@/lib/api');
        const C       = classifyLeave(r.action || '');
        const ac      = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd      = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmptyRecord(r);
        const idx     = startIdx + ri;

        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">
              {r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}
            </td>
            <td className="nc">{hz(eV)}</td>
            <td className="nc">{hz(aV)}</td>
            <td className="bc">{fmtNum(bV)}</td>
            <td className="nc">{hz(wV)}</td>
            <td className="nc">{hz(eS)}</td>
            <td className="nc">{hz(aS)}</td>
            <td className="bc">{fmtNum(bS)}</td>
            <td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`}>{r.action}</td>
            {isAdmin && (
              <EraRowMenu
                record={r}
                idx={idx}
                emp={emp}
                onRefresh={onRefresh}
                onEditRow={onEditRow}
              />
            )}
          </tr>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Teaching Era Rows
//  NOTE: bal is seeded from conv.fwdBV so the first row
//  continues from the previous era's last balance.
// ─────────────────────────────────────────────────────────────
function TEraRows({
  records, isAdmin, emp, startIdx, onRefresh, onEditRow,
}: {
  records: LeaveRecord[];
  isAdmin: boolean;
  emp: Personnel;
  startIdx: number;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
}) {
  // Seed from forwarded balance if a conversion record exists in this segment
 // REPLACE:
let bal = 0;

  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;

        const res = computeTRow(r, bal);
        bal = res.bal;
        const { aV, aS, wV, wS, isSetBLeave } = res;

        const { classifyLeave } = require('@/lib/api');
        const C       = classifyLeave(r.action || '');
        const ac      = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd      = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmptyRecord(r);
        const isE     = r.earned > 0;
        const idx     = startIdx + ri;

        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">
              {r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}
            </td>
            <td className="nc">
              {C.isTransfer ? fmtNum(r.trV || 0) : (!C.isMon && !C.isPer && isE) ? fmtNum(r.earned) : ''}
            </td>
            <td className="nc">{hz(aV)}</td>
            <td className="bc">{isSetBLeave ? '' : fmtNum(bal)}</td>
            <td className="nc">{hz(wV)}</td>
            <td className="nc">{''}</td>
            <td className="nc">{hz(aS)}</td>
            <td className="bc">{isSetBLeave ? fmtNum(bal) : ''}</td>
            <td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`} style={{ textAlign: 'left', paddingLeft: 4 }}>
              {r.action}
            </td>
            {isAdmin && (
              <EraRowMenu
                record={r}
                idx={idx}
                emp={emp}
                onRefresh={onRefresh}
                onEditRow={onEditRow}
              />
            )}
          </tr>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Per-row action menu (Edit / Delete) — same as main card
// ─────────────────────────────────────────────────────────────
function EraRowMenu({
  record, idx, emp, onRefresh, onEditRow,
}: {
  record: LeaveRecord;
  idx: number;
  emp: Personnel;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
}) {
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setOpen(false);
    if (!record._record_id) return;
    if (!confirm('Delete this row? This cannot be undone.')) return;
    const res = await apiCall('delete_record', { employee_id: emp.id, record_id: record._record_id });
    if (!res.ok) { alert('Delete failed: ' + (res.error || 'Unknown error')); return; }
    onRefresh();
  }

  return (
    <td className="no-print" style={{ textAlign: 'center', padding: '0 4px' }}>
      <div className="row-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
        <button
          className="row-menu-btn"
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        >
          ⋮
        </button>
        {open && (
          <div className="row-menu-dd open" style={{ position: 'absolute', right: 0, zIndex: 9999 }}>
            <button onClick={() => { setOpen(false); onEditRow(idx, record); }}>✏️ Edit Row</button>
            <div className="menu-div" />
            <button className="danger" onClick={handleDelete}>🗑️ Delete Row</button>
          </div>
        )}
      </div>
    </td>
  );
}
