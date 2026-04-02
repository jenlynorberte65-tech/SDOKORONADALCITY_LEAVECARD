'use client';
import { useState } from 'react';
import { LeaveTableHeader, FwdRow, computeNTRow, computeTRow } from '@/components/leavecard/LeaveCardTable';
import { fmtD, fmtNum, hz, isEmptyRecord } from '@/lib/api';
import type { LeaveRecord, Personnel } from '@/types';

interface Seg { status: string; recs: LeaveRecord[]; startIdx: number; convIdx: number; conv: LeaveRecord | null; }
interface Props { seg: Seg; si: number; emp: Personnel; isAdmin: boolean; onRefresh: () => void; cardType: 'nt' | 't'; }

export function EraSection({ seg, si, emp, isAdmin, onRefresh, cardType }: Props) {
  const [open, setOpen] = useState(false);
  const realRecs = seg.recs.filter(r => !r._conversion && !isEmptyRecord(r));
  const eraEmpty = realRecs.length === 0;
  const label = `📁 ${seg.status} Leave Record — Era ${si + 1} (${seg.recs.length} entr${seg.recs.length === 1 ? 'y' : 'ies'})`;

  return (
    <div className="era-wrapper" id={`${cardType}OldEra${si > 0 ? '_' + si : ''}`}>
      <div className={`era-old-toggle${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="era-arrow">▼</span>
        <span>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400, color: 'var(--mu)' }}>Click to expand / collapse</span>
      </div>
      <div className={`era-old-body${open ? ' open' : ''}`}>
        <div className="card" style={{ padding: 0, margin: 0 }}>
          <div className="tw">
            <table>
              <LeaveTableHeader showAction={false} />
              <tbody>
                {cardType === 'nt'
                  ? <NTEraRows records={seg.recs} />
                  : <TEraRows  records={seg.recs} />}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function NTEraRows({ records }: { records: LeaveRecord[] }) {
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

function TEraRows({ records }: { records: LeaveRecord[] }) {
  let bal = 0;
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;
        const res = computeTRow(r, bal);
        bal = res.bal;
        const { earned, aV, aS, wV, wS, isSetBLeave } = res;
        const { classifyLeave, isEmptyRecord: isEmp } = require('@/lib/api');
        const C = classifyLeave(r.action || '');
        const ac = C.isDis ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmp(r);
        const isE = r.earned > 0;
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
