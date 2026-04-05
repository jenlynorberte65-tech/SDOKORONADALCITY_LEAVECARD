'use client';
import { useState, useCallback, useRef } from 'react';import { apiCall, fmtD, fmtNum, hz, isEmptyRecord, sortRecordsByDate, computeRowBalanceUpdates }
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall, fmtD, fmtNum, hz, isEmptyRecord } from '@/lib/api';
import { ProfileBlock, LeaveTableHeader, FwdRow } from '@/components/leavecard/LeaveCardTable';
import { LeaveEntryForm } from '@/components/leavecard/LeaveEntryForm';
import { EraSection } from '@/components/leavecard/EraSection';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onBack: () => void; }

async function handleDownload() {
  const profileEl = document.getElementById('tCard');
  const tableEl   = document.getElementById('tTblCard');
  if (!profileEl) return;
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 330.2] });
  const pdfW    = pdf.internal.pageSize.getWidth();
  const margin  = 5;
  const usableW = pdfW - margin * 2;
  let cursorY   = margin;
  async function addElement(el: HTMLElement) {
    const prev = el.style.cssText;
    el.style.boxShadow    = 'none';
    el.style.border       = 'none';
    el.style.borderRadius = '0';
    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      ignoreElements: (node) => {
        const n = node as HTMLElement;
        return n.classList?.contains('no-print') || n.tagName === 'BUTTON';
      },
    });
    el.style.cssText = prev;
    const imgData = canvas.toDataURL('image/png');
    const imgH    = (canvas.height * usableW) / canvas.width;
    const pageH   = pdf.internal.pageSize.getHeight();
    if (cursorY + imgH > pageH - margin) { pdf.addPage(); cursorY = margin; }
    pdf.addImage(imgData, 'PNG', margin, cursorY, usableW, imgH);
    cursorY += imgH + 3;
  }
  if (profileEl) await addElement(profileEl);
  if (tableEl)   await addElement(tableEl);
  pdf.save(`LeaveCard_T_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function handlePrint() {
  document.querySelector('.page.on')?.classList.add('printing');
  window.print();
  setTimeout(() => document.querySelector('.page.printing')?.classList.remove('printing'), 1500);
}

export default function TCardPage({ onBack }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === state.curId) as Personnel | undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const [editIdx, setEditIdx]       = useState<number>(-1);
  const [editRecord, setEditRecord] = useState<LeaveRecord | undefined>(undefined);
  const curId   = state.curId;
  const formRef = useRef<HTMLDivElement>(null);

 const refresh = useCallback(async () => {
  if (!curId) return;
  const res = await apiCall('get_records', { employee_id: curId }, 'GET');
  if (!res.ok || !res.records) return;
  const sorted = [...res.records];
  sortRecordsByDate(sorted);
  const empStatus = emp?.status as 'Teaching' | 'Non-Teaching';
  const updates = computeRowBalanceUpdates(sorted, curId, empStatus);
  if (updates.length > 0) {
    await Promise.all(updates.map(u => apiCall('save_row_balance', u)));
  }
  const res2 = await apiCall('get_records', { employee_id: curId }, 'GET');
  if (!res2.ok || !res2.records) return;
  const sorted2 = [...res2.records];
  sortRecordsByDate(sorted2);
  dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: curId, records: sorted2 } });
  setRefreshKey(k => k + 1);
}, [curId, dispatch, emp]);
  useEffect(() => {
  refresh();
}, []);

  function handleEditRow(idx: number, record: LeaveRecord) {
    setEditIdx(idx);
    setEditRecord(record);
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  function handleCancelEdit() {
    setEditIdx(-1);
    setEditRecord(undefined);
  }

  function handleSaved() {
    setEditIdx(-1);
    setEditRecord(undefined);
    refresh();
  }

  if (!emp) return (
    <div className="card">
      <div className="cb" style={{ color: 'var(--mu)', fontStyle: 'italic' }}>No employee selected.</div>
    </div>
  );

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <button className="btn b-slt" onClick={onBack}>⬅ Back</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn b-pdf" onClick={handleDownload}>⬇ Download PDF</button>
          <button className="btn b-prn" onClick={handlePrint}>🖨 Print</button>
        </div>
      </div>

      <div className="card" id="tCard">
        <div className="ch grn center">📋 Teaching Personnel Leave Record (Service Credits)</div>
        <div className="cb"><ProfileBlock e={emp as never} /></div>
      </div>

      {!emp.archived && (state.isAdmin || state.isEncoder) && (
        <div className="card no-print" id="tFrm" ref={formRef}>
          <div className="ch amber">
            {editIdx >= 0 ? `✏ Editing Row #${editIdx + 1}` : '✏ Leave Entry Form'}
          </div>
          <div className="cb">
            <LeaveEntryForm
              empId={emp.id}
              empStatus="Teaching"
              empRecords={emp.records || []}
              editIdx={editIdx}
              editRecord={editRecord}
              onSaved={() => { handleCancelEdit(); refresh(); }}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        </div>
      )}

      <TCardTable
        key={refreshKey}
        emp={emp}
        isAdmin={!!(state.isAdmin || state.isEncoder)}
        onRefresh={refresh}
        onEditRow={handleEditRow}
      />
    </div>
  );
}

function TCardTable({ emp, isAdmin, onRefresh, onEditRow }: {
  emp: Personnel; isAdmin: boolean; onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
}) {
  const records = emp.records || [];
  const convIdxs: number[] = [];
  records.forEach((r, i) => { if (r._conversion) convIdxs.push(i); });

  if (convIdxs.length === 0) {
    return (
      <div className="card" style={{ padding: 0 }} id="tTblCard">
        <div className="tw">
          <table>
            <LeaveTableHeader showAction={isAdmin} />
            <tbody>
              <SingleTEra records={records} isAdmin={isAdmin} emp={emp} startIdx={0}
                onRefresh={onRefresh} onEditRow={onEditRow} />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const segments: { status: string; recs: LeaveRecord[]; startIdx: number; convIdx: number; conv: LeaveRecord | null }[] = [];
  let segStart  = 0;
  let curStatus = records[convIdxs[0]].fromStatus || emp.status;
  for (const cIdx of convIdxs) {
    segments.push({ status: curStatus, recs: records.slice(segStart, cIdx), startIdx: segStart, convIdx: cIdx, conv: records[cIdx] });
    curStatus = records[cIdx].toStatus || emp.status;
    segStart  = cIdx + 1;
  }
  segments.push({ status: curStatus, recs: records.slice(segStart), startIdx: segStart, convIdx: -1, conv: null });

  return (
    <>
      {segments.slice(0, -1).map((seg, si) => (
        <EraSection key={si} seg={seg} si={si} emp={emp} isAdmin={isAdmin} onRefresh={onRefresh} cardType="t" />
      ))}
      <div className="card era-new-section" style={{ padding: 0 }} id="tTblCard">
        <div className="tw">
          <table>
            <LeaveTableHeader showAction={isAdmin} />
            <tbody>
              {segments.length > 1 && segments[segments.length - 2].conv && (() => {
                const prevSeg = segments[segments.length - 2];
                const lastRec = [...prevSeg.recs].reverse().find(r => !r._conversion);
                const bV = lastRec?.setA_balance ?? 0;
                const bS = lastRec?.setB_balance ?? 0;
                return <FwdRow conv={prevSeg.conv!} bV={bV} bS={bS} status={segments[segments.length - 1].status} />;
              })()}
              <SingleTEra
                records={segments[segments.length - 1].recs}
                isAdmin={isAdmin} emp={emp}
                startIdx={segments[segments.length - 1].startIdx}
                onRefresh={onRefresh} onEditRow={onEditRow}
              />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SingleTEra({ records, isAdmin, emp, startIdx, onRefresh, onEditRow }: {
  records: LeaveRecord[]; isAdmin: boolean; emp: Personnel; startIdx: number;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
}) {
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const { classifyLeave } = require('@/lib/api');
        const C          = classifyLeave(r.action || '');
        const isE        = r.earned > 0;
        const ac         = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd         = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty    = isEmptyRecord(r);
        const idx        = startIdx + ri;
        const earned     = r.setA_earned  ?? 0;
        const aV         = r.setA_abs_wp  ?? 0;
        const balA       = r.setA_balance ?? 0;
        const wV         = r.setA_wop     ?? 0;
        const aS         = r.setB_abs_wp  ?? 0;
        const balB       = r.setB_balance ?? 0;
        const wS         = r.setB_wop     ?? 0;
        const isSetBLeave = balA === 0 && balB > 0;
        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">{r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}</td>
            <td className="nc">{C.isTransfer ? fmtNum(r.trV || 0) : (!C.isMon && !C.isPer && isE) ? fmtNum(earned) : ''}</td>
            <td className="nc">{hz(aV)}</td>
            <td className="bc">{isSetBLeave ? '' : fmtNum(balA)}</td>
            <td className="nc">{hz(wV)}</td>
            <td className="nc">{''}</td>
            <td className="nc">{hz(aS)}</td>
            <td className="bc">{isSetBLeave ? fmtNum(balB) : ''}</td>
            <td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`} style={{ textAlign: 'left', paddingLeft: 4 }}>{r.action}</td>
            {isAdmin && (
              <TRowMenu record={r} idx={idx} emp={emp}
                onRefresh={onRefresh} onEditRow={onEditRow} />
            )}
          </tr>
        );
      })}
    </>
  );
}

function TRowMenu({ record, idx, emp, onRefresh, onEditRow }: {
  record: LeaveRecord; idx: number; emp: Personnel;
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
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button className="row-menu-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>⋮</button>
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
