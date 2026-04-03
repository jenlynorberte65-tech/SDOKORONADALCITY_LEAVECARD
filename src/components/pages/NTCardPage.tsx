    'use client';
// ============================================================
//  NTCardPage — Non-Teaching Personnel Leave Card
// ============================================================
import { useState, useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall, sortRecordsByDate, validateLeaveEntry, toISODate, fmtD, fmtDateInput, computeRowBalanceUpdates } from '@/lib/api';
import { ProfileBlock, LeaveTableHeader, FwdRow, computeNTRow } from '@/components/leavecard/LeaveCardTable';
import { LeaveEntryForm } from '@/components/leavecard/LeaveEntryForm';
import { EraSection } from '@/components/leavecard/EraSection';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onBack: () => void; }

export default function NTCardPage({ onBack }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === state.curId) as Personnel | undefined;

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  if (!emp) return <div className="card"><div className="cb" style={{ color: 'var(--mu)', fontStyle: 'italic' }}>No employee selected.</div></div>;

  const isReadOnly = emp.archived;

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <button className="btn b-slt" onClick={onBack}>⬅ Back</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn b-pdf" onClick={() => window.print()}>⬇ Download PDF</button>
          <button className="btn b-prn" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      {/* Profile card */}
      <div className="card" id="ntCard">
        <div className="ch grn center">📋 Non-Teaching Personnel Leave Record</div>
        <div className="cb"><ProfileBlock e={emp as never} /></div>
      </div>

      {/* Leave entry form */}
      {!isReadOnly && (state.isAdmin || state.isEncoder) && (
        <div className="card no-print" id="ntFrm">
          <div className="ch amber">✏ Leave Entry Form</div>
          <div className="cb">
            <LeaveEntryForm
              empId={emp.id}
              empStatus="Non-Teaching"
              empRecords={emp.records || []}
             onSaved={async () => {
            const res = await apiCall('get_records', { employee_id: emp.id }, 'GET');
              if (res.ok) {
                dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, records: res.records || [], lastEditedAt: new Date().toISOString() } });
              }
            refresh();
}}
            />
          </div>
        </div>
      )}

      {/* Leave card table with era support */}
      <NTCardTable key={refreshKey} emp={emp} isAdmin={!!(state.isAdmin || state.isEncoder)} onRefresh={refresh} />
    </div>
  );
}

// ── NT Card Table (with era segmentation) ────────────────────
function NTCardTable({ emp, isAdmin, onRefresh }: { emp: Personnel; isAdmin: boolean; onRefresh: () => void }) {
  const { dispatch } = useAppStore();
  const records = emp.records || [];

  // Split into eras
  const convIdxs: number[] = [];
  records.forEach((r, i) => { if (r._conversion) convIdxs.push(i); });

  if (convIdxs.length === 0) {
    // Single era
    return (
      <div className="card" style={{ padding: 0 }} id="ntTblCard">
        <div className="tw">
          <table><LeaveTableHeader showAction={isAdmin} />
            <tbody>
              <SingleNTEra records={records} isAdmin={isAdmin} emp={emp} startIdx={0} onRefresh={onRefresh} />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Multi-era
  const segments: { status: string; recs: LeaveRecord[]; startIdx: number; convIdx: number; conv: LeaveRecord | null }[] = [];
  let segStart = 0;
  let curStatus = records[convIdxs[0]].fromStatus || emp.status;
  for (const cIdx of convIdxs) {
    segments.push({ status: curStatus, recs: records.slice(segStart, cIdx), startIdx: segStart, convIdx: cIdx, conv: records[cIdx] });
    curStatus = records[cIdx].toStatus || emp.status;
    segStart = cIdx + 1;
  }
  segments.push({ status: curStatus, recs: records.slice(segStart), startIdx: segStart, convIdx: -1, conv: null });

  return (
    <>
      {segments.slice(0, -1).map((seg, si) => (
        <EraSection key={si} seg={seg} si={si} emp={emp} isAdmin={isAdmin} onRefresh={onRefresh} cardType="nt" />
      ))}
      <div className="card era-new-section" style={{ padding: 0 }} id="ntTblCard">
        <div className="tw">
          <table><LeaveTableHeader showAction={isAdmin} />
            <tbody>
              {/* Fwd row if applicable */}
              {segments.length > 1 && segments[segments.length - 2].conv && (() => {
                const prevSeg = segments[segments.length - 2];
                let bV = 0, bS = 0;
                for (const r of prevSeg.recs) {
                  if (!r._conversion) { const res = computeNTRow(r, bV, bS); bV = res.bV; bS = res.bS; }
                }
                return <FwdRow conv={prevSeg.conv!} bV={bV} bS={bS} status={segments[segments.length - 1].status} />;
              })()}
              <SingleNTEra records={segments[segments.length - 1].recs} isAdmin={isAdmin} emp={emp} startIdx={segments[segments.length - 1].startIdx} onRefresh={onRefresh} />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SingleNTEra({ records, isAdmin, emp, startIdx, onRefresh }: { records: LeaveRecord[]; isAdmin: boolean; emp: Personnel; startIdx: number; onRefresh: () => void }) {
  const { dispatch } = useAppStore();
  let bV = 0, bS = 0;
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const res = computeNTRow(r, bV, bS);
        bV = res.bV; bS = res.bS;
        const { eV, eS, aV, aS, wV, wS } = res;
        const C   = require('@/lib/api').classifyLeave(r.action || '');
        const ac  = C.isDis ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd  = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const prd = r.prd + (dd ? `<br/><span class="prd-date">${dd}</span>` : '');
        const isEmpty = require('@/lib/api').isEmptyRecord(r);
        const idx = startIdx + ri;
        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell" dangerouslySetInnerHTML={{ __html: prd }} />
            <td className="nc">{require('@/lib/api').hz(eV)}</td><td className="nc">{require('@/lib/api').hz(aV)}</td>
            <td className="bc">{require('@/lib/api').fmtNum(bV)}</td><td className="nc">{require('@/lib/api').hz(wV)}</td>
            <td className="nc">{require('@/lib/api').hz(eS)}</td><td className="nc">{require('@/lib/api').hz(aS)}</td>
            <td className="bc">{require('@/lib/api').fmtNum(bS)}</td><td className="nc">{require('@/lib/api').hz(wS)}</td>
            <td className={`${ac} remarks-cell`}>{r.action}</td>
            {isAdmin && <RowMenu record={r} idx={idx} type="nt" emp={emp} onRefresh={onRefresh} />}
          </tr>
        );
      })}
    </>
  );
}

function RowMenu({ record, idx, type, emp, onRefresh }: { record: LeaveRecord; idx: number; type: string; emp: Personnel; onRefresh: () => void }) {
  const { dispatch } = useAppStore();
  const [open, setOpen] = useState(false);
  async function handleDelete() {
    setOpen(false);
    if (!record._record_id) return;
    if (!confirm('Delete this row? This cannot be undone.')) return;
    const res = await apiCall('delete_record', { employee_id: emp.id, record_id: record._record_id });
    if (!res.ok) { alert('Delete failed: ' + (res.error || 'Unknown error')); return; }
    const newRecords = (emp.records || []).filter((_, i) => i !== idx);
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, records: newRecords, lastEditedAt: new Date().toISOString() } });
    onRefresh();
  }
  return (
    <td className="no-print" style={{ textAlign: 'center', padding: '0 4px' }}>
      <div className="row-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
        <button className="row-menu-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>⋮</button>
        {open && (
          <div className="row-menu-dd open" style={{ position: 'absolute', right: 0, zIndex: 9999 }}>
            <button onClick={() => setOpen(false)}>✏️ Edit Row</button>
            <div className="menu-div" />
            <button className="danger" onClick={handleDelete}>🗑️ Delete Row</button>
          </div>
        )}
      </div>
    </td>
  );
}
