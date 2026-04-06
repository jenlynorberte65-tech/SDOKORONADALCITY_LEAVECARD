
'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall } from '@/lib/api';
import { ProfileBlock, LeaveTableHeader, computeNTRow, computeTRow } from '@/components/leavecard/LeaveCardTable';
import { fmtD, fmtNum, hz, isEmptyRecord } from '@/lib/api';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onLogout: () => void; }

async function capturePageAsPDF(): Promise<import('jspdf').jsPDF | null> {
  const pageEl = document.querySelector('.page.on') as HTMLElement;
  if (!pageEl) return null;

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const noPrintEls = pageEl.querySelectorAll('.no-print');
  noPrintEls.forEach(el => (el as HTMLElement).style.display = 'none');

  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: pageEl.scrollWidth,
    windowHeight: pageEl.scrollHeight,
  });

  noPrintEls.forEach(el => (el as HTMLElement).style.display = '');

  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 330.2] });
  const pdfW    = pdf.internal.pageSize.getWidth();
  const pdfH    = pdf.internal.pageSize.getHeight();
  const margin  = 8;
  const usableW = pdfW - margin * 2;
  const ratio   = canvas.width / usableW;
  let yPos      = 0;

  while (yPos < canvas.height) {
    const sliceH = Math.min((pdfH - margin * 2) * ratio, canvas.height - yPos);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width  = canvas.width;
    sliceCanvas.height = sliceH;
    sliceCanvas.getContext('2d')!.drawImage(
      canvas, 0, yPos, canvas.width, sliceH, 0, 0, canvas.width, sliceH
    );
    if (yPos > 0) pdf.addPage();
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, usableW, sliceH / ratio);
    yPos += sliceH;
  }

  return pdf;
}

async function handleDownload() {
  const pdf = await capturePageAsPDF();
  if (!pdf) return;
  pdf.save(`LeaveCard_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function handlePrint() {
  const pdf = await capturePageAsPDF();
  if (!pdf) return;
  const blob = pdf.output('blob');
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.onload = () => { win.focus(); win.print(); };
  }
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
        <button className="nb out" onClick={() => handleLogout(onLogout)} style={{ height: 40, padding: '0 18px', fontSize: 12, fontWeight: 600 }}>🔒 Logout</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn b-pdf" onClick={handleDownload}>⬇ Download PDF</button>
          <button className="btn b-prn" onClick={handlePrint}>🖨 Print</button>
        </div>
      </div>

      {/* Profile header card */}
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

      {/* Leave card table */}
      <div className="card" style={{ padding: 0 }} id="userTableCard">
        <div className="tw">
          <table>
            <LeaveTableHeader showAction={false} />
            <tbody>
              {isTeaching
                ? <TeachingRows records={emp.records || []} />
                : <NTRows       records={emp.records || []} />}
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
