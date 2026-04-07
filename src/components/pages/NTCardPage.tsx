'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { apiCall, fmtD, fmtNum, hz, isEmptyRecord, sortRecordsByDate, computeRowBalanceUpdates } from '@/lib/api';
import { useAppStore } from '@/hooks/useAppStore';
import { ProfileBlock, LeaveTableHeader, FwdRow } from '@/components/leavecard/LeaveCardTable';
import { LeaveEntryForm } from '@/components/leavecard/LeaveEntryForm';
import { EraSection } from '@/components/leavecard/EraSection';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onBack: () => void; }

const LEGAL_W_PX = 816;
const LEGAL_H_PX = 1248;
const PDF_W_MM   = 215.9;
const PDF_H_MM   = 330.2;
const MARGIN_MM  = 6;

const LOGO_URL = 'https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2019/11/korlogo.jpg';

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  :root {
    --g0:#081910;--g1:#123d2c;--g2:#1a5c42;--g3:#1e7050;--g4:#e8f5ee;
    --gd:#c8e6d6;--au:#b07d2c;--au2:#fdf5e6;
    --nb:#1e3a6e;--am:#8c4a10;--rd:#7f1d1d;--pu:#4e1d95;
    --cha:#1e2530;--mu:#6b7a8d;--br:#ced6de;--dv:#e8edf2;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',system-ui,sans-serif;font-size:10px;color:var(--cha);background:white;width:${LEGAL_W_PX}px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .print-header{display:flex;align-items:center;justify-content:center;gap:16px;padding:10px 16px 8px;border-bottom:3px solid var(--g2);margin-bottom:10px;}
  .print-header img{width:64px;height:64px;border-radius:50%;object-fit:cover;}
  .print-header-text{text-align:center;}
  .print-header-text .republic{font-size:8px;font-weight:600;color:#555;letter-spacing:1px;text-transform:uppercase;}
  .print-header-text .agency{font-size:13px;font-weight:700;color:var(--g1);margin:2px 0;}
  .print-header-text .division{font-size:10px;font-weight:600;color:var(--g2);}
  .card{background:#f8faf8;border-radius:8px;border:1px solid var(--br);margin-bottom:12px;overflow:hidden;}
  .ch{padding:8px 16px;color:white;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;display:flex;align-items:center;gap:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .ch.grn{background:linear-gradient(90deg,var(--g0),var(--g2));}
  .ch.center{justify-content:center;}
  .cb{padding:12px 16px;}
  .pg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .pi label{font-size:7px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:2px;}
  .pi span{font-size:9.5px;font-weight:500;color:var(--cha);display:block;padding-bottom:4px;border-bottom:1px solid var(--dv);}
  .tw{overflow:visible;width:100%;}
  table{width:100%;border-collapse:collapse;font-size:10px;table-layout:auto;}
  thead{display:table-header-group;}
  thead th{background:var(--g0);color:white;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border:1px solid #3a4a58;vertical-align:middle;text-align:center;padding:4px 5px;line-height:1.2;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .ths{background:#2a3a4c!important;color:#a8b8c8!important;font-size:8px!important;}
  .tha{background:var(--g2)!important;border-color:#1e6b4c!important;}
  .thb{background:var(--nb)!important;border-color:#243f7a!important;}
  tbody td{border:1px solid var(--br);padding:4px;text-align:center;white-space:nowrap;font-size:10px;}
  tbody td:nth-child(2),tbody td:last-child{white-space:normal;word-break:break-word;text-align:left;padding-left:6px;}
  tbody tr:nth-child(even){background:#f4f8f5;}
  .bc{font-weight:700;background:var(--au2)!important;color:#6b4a10;font-size:10px;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .nc{white-space:nowrap;}
  .rdc{color:var(--rd);font-weight:700;}
  .puc{color:var(--pu);font-weight:700;}
  .remarks-cell{font-size:10px;text-align:left;padding-left:5px!important;white-space:normal;word-break:break-word;line-height:1.4;}
  .period-cell{text-align:left;padding-left:5px!important;line-height:1.4;font-size:10px;font-weight:700;white-space:normal;word-break:break-word;}
  .prd-date{font-size:9.5px;font-weight:700;display:block;margin-top:1px;}
  .era-fwd-row{background:#fff9f0!important;}
  .era-fwd-row td{color:#8a5a0a!important;font-weight:700!important;font-style:italic;}
  .era-old-toggle{display:none!important;}
  .era-old-body{display:block!important;}
  .era-new-section{page-break-before:always;}
  .no-print{display:none!important;}
  button{display:none!important;}
  @page{size:8.5in 13in portrait;margin:10mm 8mm;}
`;

function buildPrintHTML(contentHTML: string, title: string, logoDataUrl?: string): string {
  const logoSrc = logoDataUrl || LOGO_URL;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="print-header">
    <img src="${logoSrc}" crossorigin="anonymous" />
    <div class="print-header-text">
      <div class="republic">Republic of the Philippines &bull; Department of Education</div>
      <div class="agency">SDO City of Koronadal &mdash; Region XII</div>
      <div class="division">Schools Division Office &mdash; Employee Leave Record</div>
    </div>
  </div>
  ${contentHTML}
</body>
</html>`;
}

async function fetchLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch(LOGO_URL, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return LOGO_URL;
  }
}

async function buildPDF(contentHTML: string): Promise<import('jspdf').jsPDF | null> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const logoDataUrl = await fetchLogoDataUrl();
  const fullHTML = buildPrintHTML(contentHTML, 'Leave Card', logoDataUrl);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${LEGAL_W_PX}px;height:${LEGAL_H_PX}px;border:none;visibility:hidden;`;
  document.body.appendChild(iframe);

  const iDoc = iframe.contentDocument!;
  iDoc.open();
  iDoc.write(fullHTML);
  iDoc.close();

  await new Promise<void>(res => {
    if (iframe.contentDocument?.readyState === 'complete') { setTimeout(res, 1000); return; }
    iframe.addEventListener('load', () => setTimeout(res, 1000), { once: true });
    setTimeout(res, 2500);
  });

  const body = iDoc.body as HTMLElement;
  const fullH = Math.max(body.scrollHeight, LEGAL_H_PX);

  const canvas = await html2canvas(body, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: LEGAL_W_PX,
    height: fullH,
    windowWidth: LEGAL_W_PX,
    windowHeight: fullH,
    scrollX: 0,
    scrollY: 0,
  });

  document.body.removeChild(iframe);

  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PDF_W_MM, PDF_H_MM] });
  const usableW = PDF_W_MM - MARGIN_MM * 2;
  const usableH = PDF_H_MM - MARGIN_MM * 2;
  const ratio   = canvas.width / usableW;
  const slicePx = usableH * ratio;
  let yPos      = 0;
  let first     = true;

  while (yPos < canvas.height) {
    const thisSlice = Math.min(slicePx, canvas.height - yPos);
    const slice = document.createElement('canvas');
    slice.width  = canvas.width;
    slice.height = Math.ceil(thisSlice);
    slice.getContext('2d')!.drawImage(canvas, 0, yPos, canvas.width, thisSlice, 0, 0, canvas.width, thisSlice);
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM, usableW, thisSlice / ratio);
    yPos += thisSlice;
  }

  return pdf;
}

function triggerPrint(contentHTML: string): void {
  const printHTML = buildPrintHTML(contentHTML, 'Leave Card', LOGO_URL);

  const container = document.createElement('div');
  container.id = '__print_container__';
  container.innerHTML = printHTML;
  container.style.display = 'none';
  document.body.appendChild(container);

  const styleTag = document.createElement('style');
  styleTag.id = '__print_styles__';
  styleTag.innerHTML = `
    @media print {
      body > *:not(#__print_container__) { display: none !important; }
      #__print_container__ { display: block !important; }
      ${PRINT_STYLES}
    }
  `;
  document.head.appendChild(styleTag);

  window.print();

  const cleanup = () => {
    document.getElementById('__print_container__')?.remove();
    document.getElementById('__print_styles__')?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 3000);
}

function getPageContent(): string {
  const pageEl = document.querySelector<HTMLElement>('.page.on');
  if (!pageEl) return '';
  const clone = pageEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('.no-print').forEach(el => el.remove());
  clone.querySelectorAll<HTMLElement>('button').forEach(el => el.remove());
  return clone.innerHTML;
}

export default function NTCardPage({ onBack }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === state.curId) as Personnel | undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const [editIdx, setEditIdx]       = useState<number>(-1);
  const [editRecord, setEditRecord] = useState<LeaveRecord | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting]       = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const curId   = state.curId;

  const refresh = useCallback(async () => {
    if (!curId) return;
    const empStatus = (state.db.find(e => e.id === curId)?.status || 'Non-Teaching') as 'Teaching' | 'Non-Teaching';
    const res = await apiCall('get_records', { employee_id: curId }, 'GET');
    if (!res.ok || !res.records) return;
    const sorted = [...res.records];
    sortRecordsByDate(sorted);
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
  }, [curId, dispatch, state.db]);

  useEffect(() => { if (curId) refresh(); }, [curId]);

  /** Download PDF directly — no new tab */
  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const content = getPageContent();
      if (!content) { alert('No content found.'); return; }
      const pdf = await buildPDF(content);
      if (pdf) pdf.save(`LeaveCard_NT_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  /** Print directly — no new tab */
  function handlePrint() {
    if (printing) return;
    setPrinting(true);
    try {
      const content = getPageContent();
      if (!content) { alert('No content found.'); return; }
      triggerPrint(content);
    } finally {
      setPrinting(false);
    }
  }

  function handleEditRow(idx: number, record: LeaveRecord) {
    setEditIdx(idx);
    setEditRecord(record);
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  function handleCancelEdit() { setEditIdx(-1); setEditRecord(undefined); }

  function handleSaved() {
    setEditIdx(-1);
    setEditRecord(undefined);
    setTimeout(() => refresh(), 500);
  }

  if (!emp) return (
    <div className="card">
      <div className="cb" style={{ color: 'var(--mu)', fontStyle: 'italic' }}>No employee selected.</div>
    </div>
  );

  const isReadOnly = emp.archived;

  return (
    <div>
      {/* ── Top action bar ── */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <button className="btn b-slt" onClick={onBack}>⬅ Back</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn b-pdf" onClick={handleDownload} disabled={downloading}>
            {downloading ? '⏳ Generating…' : '⬇ Download PDF'}
          </button>
          <button className="btn b-prn" onClick={handlePrint} disabled={printing}>
            {printing ? '⏳ Preparing…' : '🖨 Print'}
          </button>
        </div>
      </div>

      {/* ── UI card header with logo ── */}
      <div className="card" id="ntCard">
        <div className="ch grn center" style={{ gap: 12 }}>
          <img
            alt="Koronadal City Division"
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            crossOrigin="anonymous"
          />
          <span>📋 Non-Teaching Personnel Leave Record</span>
        </div>
        <div className="cb"><ProfileBlock e={emp as never} /></div>
      </div>

      {!isReadOnly && (state.isAdmin || state.isEncoder) && (
        <div className="card no-print" id="ntFrm" ref={formRef}>
          <div className="ch amber">
            {editIdx >= 0 ? `✏ Editing Row #${editIdx + 1}` : '✏ Leave Entry Form'}
          </div>
          <div className="cb">
            <LeaveEntryForm
              empId={emp.id}
              empStatus="Non-Teaching"
              empRecords={emp.records || []}
              editIdx={editIdx}
              editRecord={editRecord}
              onSaved={handleSaved}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        </div>
      )}

      <NTCardTable
        key={refreshKey}
        emp={emp}
        isAdmin={!!(state.isAdmin || state.isEncoder)}
        onRefresh={refresh}
        onEdit={handleEditRow}
      />
    </div>
  );
}

function NTCardTable({ emp, isAdmin, onRefresh, onEdit }: {
  emp: Personnel; isAdmin: boolean; onRefresh: () => void;
  onEdit: (idx: number, record: LeaveRecord) => void;
}) {
  const records = emp.records || [];
  const convIdxs: number[] = [];
  records.forEach((r, i) => { if (r._conversion) convIdxs.push(i); });

  if (convIdxs.length === 0) {
    return (
      <div className="card" style={{ padding: 0 }} id="ntTblCard">
        <div className="tw">
          <table>
            <LeaveTableHeader showAction={isAdmin} />
            <tbody>
              <SingleNTEra records={records} isAdmin={isAdmin} emp={emp} startIdx={0}
                onRefresh={onRefresh} onEdit={onEdit} />
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
        <EraSection key={si} seg={seg} si={si} emp={emp} isAdmin={isAdmin} onRefresh={onRefresh} cardType="nt" />
      ))}
      <div className="card era-new-section" style={{ padding: 0 }} id="ntTblCard">
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
              <SingleNTEra
                records={segments[segments.length - 1].recs}
                isAdmin={isAdmin} emp={emp}
                startIdx={segments[segments.length - 1].startIdx}
                onRefresh={onRefresh} onEdit={onEdit}
              />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SingleNTEra({ records, isAdmin, emp, startIdx, onRefresh, onEdit }: {
  records: LeaveRecord[]; isAdmin: boolean; emp: Personnel; startIdx: number;
  onRefresh: () => void;
  onEdit: (idx: number, record: LeaveRecord) => void;
}) {
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const { classifyLeave } = require('@/lib/api');
        const C       = classifyLeave(r.action || '');
        const ac      = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd      = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const prd     = r.prd + (dd ? `<br/><span class="prd-date">${dd}</span>` : '');
        const isEmpty = isEmptyRecord(r);
        const idx     = startIdx + ri;
        const eV = r.setA_earned  ?? 0;
        const aV = r.setA_abs_wp  ?? 0;
        const bV = r.setA_balance ?? 0;
        const wV = r.setA_wop     ?? 0;
        const eS = r.setB_earned  ?? 0;
        const aS = r.setB_abs_wp  ?? 0;
        const bS = r.setB_balance ?? 0;
        const wS = r.setB_wop     ?? 0;
        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell" dangerouslySetInnerHTML={{ __html: prd }} />
            <td className="nc">{hz(eV)}</td><td className="nc">{hz(aV)}</td>
            <td className="bc">{fmtNum(bV)}</td><td className="nc">{hz(wV)}</td>
            <td className="nc">{hz(eS)}</td><td className="nc">{hz(aS)}</td>
            <td className="bc">{fmtNum(bS)}</td><td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`}>{r.action}</td>
            {isAdmin && (
              <RowMenu record={r} idx={idx} type="nt" emp={emp}
                onRefresh={onRefresh} onEdit={onEdit} />
            )}
          </tr>
        );
      })}
    </>
  );
}

function RowMenu({ record, idx, type, emp, onRefresh, onEdit }: {
  record: LeaveRecord; idx: number; type: string; emp: Personnel;
  onRefresh: () => void;
  onEdit: (idx: number, record: LeaveRecord) => void;
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
        <button className="row-menu-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>⋮</button>
        {open && (
          <div className="row-menu-dd open" style={{ position: 'absolute', right: 0, zIndex: 9999 }}>
            <button onClick={() => { setOpen(false); onEdit(idx, record); }}>✏️ Edit Row</button>
            <div className="menu-div" />
            <button className="danger" onClick={handleDelete}>🗑️ Delete Row</button>
          </div>
        )}
      </div>
    </td>
  );
}
