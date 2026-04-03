'use client';
import { useState, useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall, fmtD, fmtNum, hz, isEmptyRecord, computeRowBalanceUpdates, sortRecordsByDate } from '@/lib/api';
import { ProfileBlock, LeaveTableHeader, FwdRow, computeTRow } from '@/components/leavecard/LeaveCardTable';
import { LeaveEntryForm } from '@/components/leavecard/LeaveEntryForm';
import { EraSection } from '@/components/leavecard/EraSection';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onBack: () => void; }

export default function TCardPage({ onBack }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === state.curId) as Personnel | undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  if (!emp) return <div className="card"><div className="cb" style={{ color: 'var(--mu)', fontStyle: 'italic' }}>No employee selected.</div></div>;

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <button className="btn b-slt" onClick={onBack}>⬅ Back</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn b-pdf" onClick={() => window.print()}>⬇ Download PDF</button>
          <button className="btn b-prn" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      <div className="card" id="tCard">
        <div className="ch grn center">📋 Teaching Personnel Leave Record (Service Credits)</div>
        <div className="cb"><ProfileBlock e={emp as never} /></div>
      </div>

      {!emp.archived && (state.isAdmin || state.isEncoder) && (
        <div className="card no-print" id="tFrm">
          <div className="ch amber">✏ Leave Entry Form</div>
          <div className="cb">
            <LeaveEntryForm
              empId={emp.id}
              empStatus="Teaching"
              empRecords={emp.records || []}
             onSaved={async () => {
  const res = await apiCall('get_records', { employee_id: emp.id }, 'GET');
  if (res.ok) {
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, records: res.records || [], lastEditedAt: new Date().toISOString() } });
  }
  refresh();
}}}
            />
          </div>
        </div>
      )}

      <TCardTable key={refreshKey} emp={emp} isAdmin={!!(state.isAdmin || state.isEncoder)} onRefresh={refresh} />
    </div>
  );
}

function TCardTable({ emp, isAdmin, onRefresh }: { emp: Personnel; isAdmin: boolean; onRefresh: () => void }) {
  const records = emp.records || [];
  const convIdxs: number[] = [];
  records.forEach((r, i) => { if (r._conversion) convIdxs.push(i); });

  if (convIdxs.length === 0) {
    return (
      <div className="card" style={{ padding: 0 }} id="tTblCard">
        <div className="tw">
          <table><LeaveTableHeader showAction={isAdmin} />
            <tbody><SingleTEra records={records} isAdmin={isAdmin} emp={emp} startIdx={0} onRefresh={onRefresh} /></tbody>
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
        <EraSection key={si} seg={seg} si={si} emp={emp} isAdmin={isAdmin} onRefresh={onRefresh} cardType="t" />
      ))}
      <div className="card era-new-section" style={{ padding: 0 }} id="tTblCard">
        <div className="tw">
          <table><LeaveTableHeader showAction={isAdmin} />
            <tbody>
              {segments.length > 1 && segments[segments.length - 2].conv && (() => {
                const prevSeg = segments[segments.length - 2];
                let bal = 0;
                for (const r of prevSeg.recs) {
                  if (!r._conversion) { const res = computeTRow(r, bal); bal = res.bal; }
                }
                return <FwdRow conv={prevSeg.conv!} bV={bal} bS={bal} status={segments[segments.length - 1].status} />;
              })()}
              <SingleTEra records={segments[segments.length - 1].recs} isAdmin={isAdmin} emp={emp} startIdx={segments[segments.length - 1].startIdx} onRefresh={onRefresh} />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SingleTEra({ records, isAdmin, emp, startIdx, onRefresh }: { records: LeaveRecord[]; isAdmin: boolean; emp: Personnel; startIdx: number; onRefresh: () => void }) {
  const { dispatch } = useAppStore();
  let bal = 0;
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const res = computeTRow(r, bal);
        bal = res.bal;
        const { earned, aV, aS, wV, wS, isSetBLeave } = res;
        const { classifyLeave } = require('@/lib/api');
        const C   = classifyLeave(r.action || '');
        const isE = r.earned > 0;
        const ac  = C.isDis ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd  = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmptyRecord(r);
        const idx = startIdx + ri;

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
            <td className={`${ac} remarks-cell`} style={{ textAlign: 'left', paddingLeft: 4 }}>{r.action}</td>
            {isAdmin && <TRowMenu record={r} idx={idx} emp={emp} onRefresh={onRefresh} />}
          </tr>
        );
      })}
    </>
  );
}

function TRowMenu({ record, idx, emp, onRefresh }: { record: LeaveRecord; idx: number; emp: Personnel; onRefresh: () => void }) {
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
      <div style={{ position: 'relative', display: 'inline-block' }}>
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
