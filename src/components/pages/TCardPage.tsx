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

// Base64 logo — Koronadal City Division seal
// Logo embedded as base64 — no network request needed
const LOGO_URL = 'data:image/jpeg;base64,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';

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

/** Build a full HTML document string for printing/PDF */
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

/** Logo is already a base64 data URL — return it directly, no fetch needed */
async function fetchLogoDataUrl(): Promise<string> {
  return LOGO_URL;
}

/** Download as PDF — renders in a hidden iframe, captures with html2canvas, saves with jsPDF */
async function buildPDF(contentHTML: string): Promise<import('jspdf').jsPDF | null> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  // Fetch logo as data URL so html2canvas can render it without CORS issues
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

/** Print directly in the current window — inject a style tag, print, then remove it */
async function triggerPrint(contentHTML: string): Promise<void> {
  // Fetch logo as base64 so it renders in the injected container without CORS/referrer issues
  const logoDataUrl = await fetchLogoDataUrl();

  // Build the full printable HTML string
  const printHTML = buildPrintHTML(contentHTML, 'Leave Card', logoDataUrl);

  // Create a hidden div to hold the print content
  const container = document.createElement('div');
  container.id = '__print_container__';
  container.innerHTML = printHTML;
  container.style.display = 'none';
  document.body.appendChild(container);

  // Inject print styles that show only our container
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

  // Trigger the browser's native print dialog
  window.print();

  // Clean up after printing
  const cleanup = () => {
    document.getElementById('__print_container__')?.remove();
    document.getElementById('__print_styles__')?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Fallback cleanup in case afterprint doesn't fire
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

export default function TCardPage({ onBack }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === state.curId) as Personnel | undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const [editIdx, setEditIdx]       = useState<number>(-1);
  const [editRecord, setEditRecord] = useState<LeaveRecord | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting]       = useState(false);
  const curId   = state.curId;
  const formRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!curId) return;
    const empStatus = (state.db.find(e => e.id === curId)?.status || 'Teaching') as 'Teaching' | 'Non-Teaching';
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
      if (pdf) pdf.save(`LeaveCard_T_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  /** Print directly — no new tab */
  async function handlePrint() {
    if (printing) return;
    setPrinting(true);
    try {
      const content = getPageContent();
      if (!content) { alert('No content found.'); return; }
      await triggerPrint(content);
    } catch (err) {
      console.error('Print error:', err);
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
      <div className="card" id="tCard">
        <div className="ch grn center" style={{ gap: 12 }}>
          {/* Logo visible in the UI header */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_URL}
            alt="Koronadal City Division"
            referrerPolicy="no-referrer"
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)' }}
          />
          <span>📋 Teaching Personnel Leave Record (Service Credits)</span>
        </div>
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
              onSaved={handleSaved}
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
    <EraSection
      key={si}
      seg={{
        ...seg,
        // Replace seg.conv (which closes THIS era) with the conv that
        // OPENED this era — i.e. the previous segment's closing conv.
        // For si=0 this is null (Era 1 never has a forwarded balance).
        conv: si === 0 ? null : (segments[si - 1].conv ?? null),
      }}
      si={si}
      emp={emp}
      isAdmin={isAdmin}
      onRefresh={onRefresh}
     onEditRow={onEditRow}
      cardType="t"
    />
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
                isAdmin={isAdmin}
                emp={emp}
                startIdx={segments[segments.length - 1].startIdx}
                onRefresh={onRefresh}
                onEditRow={onEditRow}
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
        const C           = classifyLeave(r.action || '');
        const isE         = r.earned > 0;
        const ac          = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd          = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty     = isEmptyRecord(r);
        const idx         = startIdx + ri;
        const earned      = r.setA_earned  ?? 0;
        const aV          = r.setA_abs_wp  ?? 0;
        const balA        = r.setA_balance ?? 0;
        const wV          = r.setA_wop     ?? 0;
        const aS          = r.setB_abs_wp  ?? 0;
        const balB        = r.setB_balance ?? 0;
        const wS          = r.setB_wop     ?? 0;
        const isSetBLeave = balA === 0 && balB > 0;
        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">{r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}</td>
            <td className="nc">{C.isTransfer ? fmtNum(r.trV || 0) : (!C.isMon && !C.isPer && isE) ? fmtNum(earned) : ''}</td>
            <td className="nc">{hz(aV)}</td>
           <td className="bc">{isSetBLeave ? '' : (balA > 0 ? fmtNum(balA) : '')}</td>
            <td className="nc">{hz(wV)}</td>
            <td className="nc">{''}</td>
            <td className="nc">{hz(aS)}</td>
            <td className="bc">{isSetBLeave ? (balB > 0 ? fmtNum(balB) : '') : ''}</td>
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
      <div className="row-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
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
