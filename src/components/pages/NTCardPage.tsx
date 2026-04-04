'use client';
// ============================================================
//  NTCardPage — Non-Teaching Personnel Leave Card
// ============================================================
import { useState, useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall, fmtD, fmtNum, hz, isEmptyRecord } from '@/lib/api';
import { ProfileBlock, LeaveTableHeader, FwdRow } from '@/components/leavecard/LeaveCardTable';
import { LeaveEntryForm } from '@/components/leavecard/LeaveEntryForm';
import { EraSection } from '@/components/leavecard/EraSection';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onBack: () => void; }

export default function NTCardPage({ onBack }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === state.curId) as Personnel | undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const curId = state.curId;

  const refresh = useCallback(async () => {
    if (!curId) return;
    const res = await apiCall('get_records', { employee_id: curId }, 'GET');
    if (res.ok && res.records) {
      dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: curId, records: res.records } });
    }
    setRefreshKey(k => k + 1);
  }, [curId, dispatch]);

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

      <div className="card" id="ntCard">
        <div className="ch grn center">📋 Non-Teaching Personnel Leave Record</div>
        <div className="cb"><ProfileBlock e={emp as never} /></div>
      </div>

      {!isReadOnly && (state.isAdmin || state.isEncoder) && (
        <div className="card no-print" id="ntFrm">
          <div className="ch amber">✏ Leave Entry Form</div>
          <div className="cb">
            <LeaveEntryForm
              empId={emp.id}
              empStatus="Non-Teaching"
              empRecords={emp.records || []}
              onSaved={refresh}
            />
          </div>
        </div>
      )}

      <NTCardTable key={refreshKey} emp={emp} isAdmin={!!(state.isAdmin || state.isEncoder)} onRefresh={refresh} />
    </div>
  );
}

function NTCardTable({ emp, isAdmin, onRefresh }: { emp: Personnel; isAdmin: boolean; onRefresh: () => void }) {
  const records = emp.records || [];
  const convIdxs: number[] = [];
  records.forEach((r, i) => { if (r._conversion) convIdxs.push(i); });

  if (convIdxs.length === 0) {
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
              {segments.length > 1 && segments[segments.length - 2].conv && (() => {
                const prevSeg = segments[segments.length - 2];
                const lastRec = [...prevSeg.recs].reverse().find(r => !r._conversion);
                const bV = lastRec?.setA_balance ?? 0;
                const bS = lastRec?.setB_balance ?? 0;
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
  // REPLACE WITH (in both SingleNTEra and SingleTEra):
  const [editIdx, setEditIdx] = useState<number | null>(null);

  function handleEdit(idx: number, record: LeaveRecord) {
    setEditIdx(editIdx === idx ? null : idx);
    // Scroll to leave entry form at the top
    setTimeout(() => {
      const formEl = document.getElementById('ntFrm') || document.getElementById('tFrm');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const { classifyLeave } = require('@/lib/api');
        const C   = classifyLeave(r.action || '');
        const ac  = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd  = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const prd = r.prd + (dd ? `<br/><span class="prd-date">${dd}</span>` : '');
        const isEmpty = isEmptyRecord(r);
        const idx = startIdx + ri;

        const eV = r.setA_earned  ?? 0;
        const aV = r.setA_abs_wp  ?? 0;
        const bV = r.setA_balance ?? 0;
        const wV = r.setA_wop     ?? 0;
        const eS = r.setB_earned  ?? 0;
        const aS = r.setB_abs_wp  ?? 0;
        const bS = r.setB_balance ?? 0;
        const wS = r.setB_wop     ?? 0;

        return (
          <>
            <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
              <td>{r.so}</td>
              <td className="period-cell" dangerouslySetInnerHTML={{ __html: prd }} />
              <td className="nc">{hz(eV)}</td><td className="nc">{hz(aV)}</td>
              <td className="bc">{fmtNum(bV)}</td><td className="nc">{hz(wV)}</td>
              <td className="nc">{hz(eS)}</td><td className="nc">{hz(aS)}</td>
              <td className="bc">{fmtNum(bS)}</td><td className="nc">{hz(wS)}</td>
              <td className={`${ac} remarks-cell`}>{r.action}</td>
              {isAdmin && (
                <RowMenu
                  record={r}
                  idx={idx}
                  emp={emp}
                  onRefresh={onRefresh}
                  onEdit={() => setEditIdx(editIdx === idx ? null : idx)}
                />
              )}
            </tr>
            {isAdmin && editIdx === idx && (
              <tr key={`edit-${r._record_id || ri}`}>
                <td colSpan={12} style={{ padding: 12, background: '#fffbea', borderTop: '2px solid var(--amber, #f59e0b)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--amber, #b45309)' }}>✏️ Editing Row #{idx + 1}</div>
                  <LeaveEntryForm
                    empId={emp.id}
                    empStatus="Non-Teaching"
                    empRecords={emp.records || []}
                    editIdx={idx}
                    editRecord={r}
                    onSaved={() => { setEditIdx(null); onRefresh(); }}
                    onCancelEdit={() => setEditIdx(null)}
                  />
                </td>
              </tr>
            )}
          </>
        );
      })}
    </>
  );
}

function RowMenu({ record, idx, emp, onRefresh, onEdit }: { record: LeaveRecord; idx: number; emp: Personnel; onRefresh: () => void; onEdit: () => void }) {
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
        <button className="row-menu-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>⋮</button>
        {open && (
          <div className="row-menu-dd open" style={{ position: 'absolute', right: 0, zIndex: 9999 }}>
            <button onClick={() => { setOpen(false); onEdit(); }}>✏️ Edit Row</button>
            <div className="menu-div" />
            <button className="danger" onClick={handleDelete}>🗑️ Delete Row</button>
          </div>
        )}
      </div>
    </td>
  );
}
