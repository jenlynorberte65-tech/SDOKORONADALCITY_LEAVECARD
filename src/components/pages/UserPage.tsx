'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall } from '@/lib/api';
import { ProfileBlock, LeaveTableHeader, computeNTRow, computeTRow } from '@/components/leavecard/LeaveCardTable';
import { fmtD, fmtNum, hz, isEmptyRecord } from '@/lib/api';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onLogout: () => void; }

async function buildPDF(): Promise<import('jspdf').jsPDF | null> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pageEl = document.querySelector<HTMLElement>('.page.on');
  if (!pageEl) return null;

  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 330.2] });
  const pdfW    = pdf.internal.pageSize.getWidth();
  const pdfH    = pdf.internal.pageSize.getHeight();
  const margin  = 6;
  const usableW = pdfW - margin * 2;

  const savedStyle = pageEl.getAttribute('style') || '';
  pageEl.style.overflow  = 'visible';
  pageEl.style.maxHeight = 'none';
  pageEl.style.height    = 'auto';

  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: -window.scrollY,
    width:        pageEl.scrollWidth,
    height:       pageEl.scrollHeight,
    windowWidth:  pageEl.scrollWidth,
    windowHeight: pageEl.scrollHeight,
    ignoreElements: (node) => {
      const n = node as HTMLElement;
      return n.classList?.contains('no-print') || n.tagName === 'BUTTON';
    },
  });

  pageEl.setAttribute('style', savedStyle);

  const ratio = canvas.width / usableW;
  let yPos = 0;
  let first = true;

  while (yPos < canvas.height) {
    const sliceH = Math.min((pdfH - margin * 2) * ratio, canvas.height - yPos);
    const slice  = document.createElement('canvas');
    slice.width  = canvas.width;
    slice.height = Math.ceil(sliceH);
    slice.getContext('2d')!.drawImage(canvas, 0, yPos, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, usableW, sliceH / ratio);
    yPos += sliceH;
  }

  return pdf;
}

async function handleDownload() {
  const pdf = await buildPDF();
  if (!pdf) return;
  pdf.save(`LeaveCard_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function handlePrint() {
  const pageEl = document.querySelector<HTMLElement>('.page.on');
  if (!pageEl) return;

  const clone = pageEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('.no-print').forEach(el => el.remove());
  clone.querySelectorAll<HTMLElement>('button').forEach(el => el.remove());

  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Leave Card</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    :root {
      --g0:#081910;--g1:#123d2c;--g2:#1a5c42;--g3:#1e7050;--g4:#e8f5ee;
      --gd:#c8e6d6;--au:#b07d2c;--au2:#fdf5e6;--au3:#f0d28a;
      --nb:#1e3a6e;--am:#8c4a10;--rd:#7f1d1d;--pu:#4e1d95;
      --cha:#1e2530;--sl:#3d4d60;--mu:#6b7a8d;--br:#ced6de;--dv:#e8edf2;
      --bg:#ebede9;--cd:#f8faf8;--wh:#ffffff;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10px;
      color: var(--cha);
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Print header ── */
    .print-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 10px 16px 8px;
      border-bottom: 3px solid var(--g2);
      margin-bottom: 10px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-header img {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
    }
    .print-header-text { text-align: center; }
    .print-header-text .republic {
      font-size: 8px;
      font-weight: 600;
      color: #555;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .print-header-text .agency {
      font-size: 13px;
      font-weight: 700;
      color: var(--g1);
      margin: 2px 0;
    }
    .print-header-text .division {
      font-size: 10px;
      font-weight: 600;
      color: var(--g2);
    }

    /* ── Card ── */
    .card {
      background: #f8faf8;
      border-radius: 8px;
      border: 1px solid var(--br);
      margin-bottom: 12px;
      overflow: hidden;
    }
    .ch {
      padding: 8px 16px;
      color: white;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .9px;
      display: flex;
      align-items: center;
      gap: 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ch.grn { background: linear-gradient(90deg, var(--g0), var(--g2)); }
    .ch.center { justify-content: center; }
    .cb { padding: 12px 16px; }

    /* ── Profile grid ── */
    .pg { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
    .pi label {
      font-size: 7px; font-weight: 600; color: var(--mu);
      text-transform: uppercase; letter-spacing: .6px;
      display: block; margin-bottom: 2px;
    }
    .pi span {
      font-size: 9.5px; font-weight: 500; color: var(--cha);
      display: block; padding-bottom: 4px;
      border-bottom: 1px solid var(--dv);
    }

    /* ── Table ── */
    .tw { overflow: visible; width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: auto; }
    thead th {
      background: var(--g0);
      color: white;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .4px;
      border: 1px solid #3a4a58;
      vertical-align: middle;
      text-align: center;
      padding: 4px 5px;
      line-height: 1.2;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ths { background: #2a3a4c !important; color: #a8b8c8 !important; font-size: 8px !important; }
    .tha { background: var(--g2) !important; border-color: #1e6b4c !important; }
    .thb { background: var(--nb) !important; border-color: #243f7a !important; }
    tbody td {
      border: 1px solid var(--br);
      padding: 4px 4px;
      text-align: center;
      white-space: nowrap;
      font-size: 10px;
    }
    tbody td:nth-child(2), tbody td:last-child { white-space: normal; word-break: break-word; text-align: left; padding-left: 6px; }
    tbody tr:nth-child(even) { background: #f4f8f5; }
    .bc { font-weight: 700; background: var(--au2) !important; color: #6b4a10; font-size: 10px; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .nc { white-space: nowrap; }
    .rdc { color: var(--rd); font-weight: 700; }
    .puc { color: var(--pu); font-weight: 700; }
    .remarks-cell { font-size: 10px; text-align: left; padding-left: 5px !important; white-space: normal; word-break: break-word; line-height: 1.4; }
    .period-cell { text-align: left; padding-left: 5px !important; line-height: 1.4; font-size: 10px; font-weight: 700; white-space: normal; word-break: break-word; }
    .prd-date { font-size: 9.5px; font-weight: 700; display: block; margin-top: 1px; }

    /* ── Era rows ── */
    .era-fwd-row { background: #fff9f0 !important; }
    .era-fwd-row td { color: #8a5a0a !important; font-weight: 700 !important; font-style: italic; }
    .era-old-toggle { display: none !important; }
    .era-old-body { display: block !important; }

    @page { size: 8.5in 13in portrait; margin: 10mm 8mm; }
    @media print {
      body { font-size: 10px !important; }
      thead { display: table-header-group; }
      .card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <img src="https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2019/11/korlogo.jpg"
         onerror="this.src='https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2020/05/korlogo2.jpg'" />
    <div class="print-header-text">
      <div class="republic">Republic of the Philippines &bull; Department of Education</div>
      <div class="agency">SDO City of Koronadal &mdash; Region XII</div>
      <div class="division">Employee Leave Record</div>
    </div>
  </div>
  ${clone.innerHTML}
</body>
</html>`);

  win.document.close();
  win.addEventListener('load', () => {
    win.focus();
    win.print();
  });
}

function handleLogout(onLogout: () => void) {
  if (!confirm('Are you sure you want to log out?')) return;
  onLogout();
}

export default function UserPage({ onLogout }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === state.curId) as Personnel | undefined;

  useEffect(() => {
    if (!emp || (emp.records && emp.records.length > 0)) return;
    apiCall('get_records', { employee_id: emp.id }, 'GET').then(res => {
      if (res.ok) dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: emp.id, records: res.records || [] } });
    });
  }, [emp?.id]);

  if (!emp) return null;

  const isTeaching = emp.status === 'Teaching';

  return (
    <div>
      <div className="user-action-bar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn b-pdf" onClick={handleDownload}>⬇ Download PDF</button>
          <button className="btn b-prn" onClick={handlePrint}>🖨 Print</button>
        </div>
      </div>

      <div className="card" id="userProfileCard">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px 10px', borderBottom: '2px solid var(--g2)', background: 'linear-gradient(90deg,var(--g0),var(--g1))' }}>
          <img src="https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2019/11/korlogo.jpg" alt="SDO"
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', flexShrink: 0 }}
            onError={e => { e.currentTarget.src = 'https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2020/05/korlogo2.jpg'; }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.7)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Republic of the Philippines · Department of Education</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '.3px', marginTop: 2 }}>SDO City of Koronadal — Region XII</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.55)', marginTop: 1, letterSpacing: '.5px' }}>Employee Leave Record</div>
          </div>
        </div>
        <div className="ch grn center">
          {isTeaching ? '📋 Teaching Personnel Leave Record (Service Credits)' : '📋 Non-Teaching Personnel Leave Record'}
        </div>
        <div className="cb"><ProfileBlock e={emp as never} /></div>
      </div>

      <div className="card" style={{ padding: 0 }} id="userTableCard">
        <div className="tw">
          <table>
            <LeaveTableHeader showAction={false} />
            <tbody>
              {isTeaching
                ? <TeachingRows records={emp.records || []} />
                : <NTRows records={emp.records || []} />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NTRows({ records }: { records: LeaveRecord[] }) {
  let bV = 0, bS = 0;
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const res = computeNTRow(r, bV, bS);
        bV = res.bV; bS = res.bS;
        const { eV, eS, aV, aS, wV, wS } = res;
        const { classifyLeave } = require('@/lib/api');
        const C = classifyLeave(r.action || '');
        const ac = C.isDis ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmptyRecord(r);
        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">{r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}</td>
            <td className="nc">{hz(eV)}</td><td className="nc">{hz(aV)}</td>
            <td className="bc">{fmtNum(bV)}</td><td className="nc">{hz(wV)}</td>
            <td className="nc">{hz(eS)}</td><td className="nc">{hz(aS)}</td>
            <td className="bc">{fmtNum(bS)}</td><td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`}>{r.action}</td>
          </tr>
        );
      })}
    </>
  );
}

function TeachingRows({ records }: { records: LeaveRecord[] }) {
  let bal = 0;
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const res = computeTRow(r, bal);
        bal = res.bal;
        const { aV, aS, wV, wS, isSetBLeave } = res;
        const { classifyLeave } = require('@/lib/api');
        const C = classifyLeave(r.action || '');
        const isE = r.earned > 0;
        const ac = C.isDis ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmptyRecord(r);
        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">{r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}</td>
            <td className="nc">{C.isTransfer ? fmtNum(r.trV || 0) : (!C.isMon && !C.isPer && isE) ? fmtNum(r.earned) : ''}</td>
            <td className="nc">{hz(aV)}</td>
            <td className="bc">{isSetBLeave ? '' : fmtNum(bal)}</td>
            <td className="nc">{hz(wV)}</td>
            <td className="nc">{''}</td>
            <td className="nc">{hz(aS)}</td>
            <td className="bc">{isSetBLeave ? fmtNum(bal) : ''}</td>
            <td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`} style={{ textAlign: 'left', paddingLeft: 4 }}>{r.action}</td>
          </tr>
        );
      })}
    </>
  );
}
