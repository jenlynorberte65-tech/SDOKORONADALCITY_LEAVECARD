'use client';
import { useState, useEffect } from 'react';
import { apiCall, toISODate, fmtDateInput, validateLeaveEntry, sortRecordsByDate, computeRowBalanceUpdates } from '@/lib/api';
import { useAppStore } from '@/hooks/useAppStore';
import type { LeaveRecord, Personnel } from '@/types';

const KNOWN_ACTIONS = [
  'Vacation Leave','Mandatory/Force Leave','Sick Leave','Personal Leave',
  'Compensatory Time Off (CTO)','Maternity Leave','Paternity Leave',
  'Special Privilege Leave (SPL)','Solo Parent Leave','Study Leave',
  'Rehabilitation Leave','Wellness Leave',
  'Special Leave Benefits for Women (Magna Carta)',
  'Violence Against Women and Children (VAWC) Leave','Terminal Leave',
  'Monetization','Monetization (disapproved)','Force Leave (disapproved)',
  'From DENR Region 12',
];

interface Props {
  empId: string;
  empStatus: 'Teaching' | 'Non-Teaching';
  empRecords: LeaveRecord[];
  editIdx?: number;
  editRecord?: LeaveRecord;
  insertAfterSortOrder?: number | null;
  onSaved: () => void;
  onCancelEdit?: () => void;
}

export function LeaveEntryForm({ empId, empStatus, empRecords, editIdx = -1, editRecord, insertAfterSortOrder, onSaved, onCancelEdit }: Props) {
  const { state, dispatch } = useAppStore();
  const emp = state.db.find(e => e.id === empId) as Personnel | undefined;

  const [so, setSo]         = useState(editRecord?.so || '');
  const [prd, setPrd]       = useState(editRecord?.prd || '');
  const [frText, setFrText] = useState(editRecord?.from ? isoToDisplay(editRecord.from) : '');
  const [toText, setToText] = useState(editRecord?.to   ? isoToDisplay(editRecord.to)   : '');
  const [frPick, setFrPick] = useState(editRecord?.from || '');
  const [toPick, setToPick] = useState(editRecord?.to   || '');
  const [action, setAction] = useState(editRecord?.action || '');
  const [note, setNote]     = useState('');
  const [earned, setEarned] = useState(editRecord?.earned ? String(editRecord.earned) : '');
  const [force, setForce]   = useState(editRecord?.forceAmount ? String(editRecord.forceAmount) : '');
  const [monV, setMonV]     = useState(editRecord?.monV ? String(editRecord.monV) : '');
  const [monS, setMonS]     = useState(editRecord?.monS ? String(editRecord.monS) : '');
  const [monDV, setMonDV]   = useState(editRecord?.monDV ? String(editRecord.monDV) : '');
  const [monDS, setMonDS]   = useState(editRecord?.monDS ? String(editRecord.monDS) : '');
  const [monAmt, setMonAmt] = useState(editRecord?.monAmount ? String(editRecord.monAmount) : '');
  const [monDis, setMonDis] = useState(editRecord?.monDisAmt ? String(editRecord.monDisAmt) : '');
  const [trV, setTrV]       = useState(editRecord?.trV ? String(editRecord.trV) : '');
  const [trS, setTrS]       = useState(editRecord?.trS ? String(editRecord.trS) : '');
  const [saving, setSaving] = useState(false);

  const isInsertMode = insertAfterSortOrder != null && editIdx === -1;
  const btnLabel = editIdx > -1 ? '💾 Save Changes' : isInsertMode ? '💾 Insert Row' : '💾 Save Entry';

  function isoToDisplay(iso: string): string {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
  }

  useEffect(() => {
    if (editRecord) {
      setSo(editRecord.so || '');
      setPrd(editRecord.prd || '');
      setFrText(isoToDisplay(editRecord.from || ''));
      setToText(isoToDisplay(editRecord.to || ''));
      setFrPick(editRecord.from || '');
      setToPick(editRecord.to || '');
      setAction(editRecord.action || '');
      setEarned(editRecord.setA_earned ? String(editRecord.setA_earned) : '');
      setForce(editRecord.forceAmount ? String(editRecord.forceAmount) : '');
      setMonV(editRecord.monV ? String(editRecord.monV) : '');
      setMonS(editRecord.monS ? String(editRecord.monS) : '');
      setMonDV(editRecord.monDV ? String(editRecord.monDV) : '');
      setMonDS(editRecord.monDS ? String(editRecord.monDS) : '');
      setMonAmt(editRecord.monAmount ? String(editRecord.monAmount) : '');
      setMonDis(editRecord.monDisAmt ? String(editRecord.monDisAmt) : '');
      setTrV(editRecord.trV ? String(editRecord.trV) : '');
      setTrS(editRecord.trS ? String(editRecord.trS) : '');
    } else {
      setSo(''); setPrd(''); setFrText(''); setToText('');
      setFrPick(''); setToPick(''); setAction(''); setEarned('');
      setForce(''); setMonV(''); setMonS(''); setMonDV(''); setMonDS('');
      setMonAmt(''); setMonDis(''); setTrV(''); setTrS('');
    }
  }, [editRecord]);

  const al    = action.toLowerCase();
  const isMon = al.includes('monetization') && !al.includes('disapproved');
  const isMD  = al.includes('monetization') &&  al.includes('disapproved');
  const isTr  = al.includes('from denr');

  function handleFromChange(iso: string) {
    setFrPick(iso);
    if (iso) {
      setFrText(isoToDisplay(iso));
      setToPick(p => p < iso ? '' : p);
      if (toPick && toPick < iso) setToText('');
    }
  }

  function handleToChange(iso: string) {
    if (frPick && iso < frPick) { alert('⚠️ "Date To" cannot be earlier than "Date From".'); return; }
    setToPick(iso);
    if (iso) setToText(isoToDisplay(iso));
  }

  function handleFromText(v: string) {
    const formatted = fmtDateInput(v);
    setFrText(formatted);
    const iso = toISODate(formatted);
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      setFrPick(iso);
      if (toPick && toPick < iso) { setToPick(''); setToText(''); }
    }
  }

  function handleToText(v: string) {
    const formatted = fmtDateInput(v);
    setToText(formatted);
    const iso = toISODate(formatted);
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      if (frPick && iso < frPick) { alert('⚠️ "Date To" cannot be earlier than "Date From".'); return; }
      setToPick(iso);
    }
  }

  async function handleSave() {
    const av = action.trim() && note.trim()
      ? `${action.trim()}, ${note.trim()}`
      : (action.trim() || note.trim());
    const d: LeaveRecord = {
      so, prd,
      from: toISODate(frText) || frPick,
      to:   toISODate(toText) || toPick,
      spec: '',
      action: av,
      earned:      parseFloat(earned) || 0,
      forceAmount: (av.toLowerCase().includes('force') || av.toLowerCase().includes('mandatory')) ? (parseFloat(force) || 0) : 0,
      monV:        isMon ? (parseFloat(monV)   || 0) : 0,
      monS:        isMon ? (parseFloat(monS)   || 0) : 0,
      monDV:       isMD  ? (parseFloat(monDV)  || 0) : 0,
      monDS:       isMD  ? (parseFloat(monDS)  || 0) : 0,
      monAmount:   isMon ? (parseFloat(monAmt) || 0) : 0,
      monDisAmt:   isMD  ? (parseFloat(monDis) || 0) : 0,
      trV: isTr ? (parseFloat(trV) || 0) : 0,
      trS: isTr ? (parseFloat(trS) || 0) : 0,
    };
    if (d.from && d.to && d.from > d.to) { alert('⚠️ "Date From" cannot be later than "Date To".'); return; }
    const valErr = validateLeaveEntry(empRecords, d, editIdx, empStatus);
    if (valErr) { alert(valErr); return; }

    setSaving(true);
    const existingId = editIdx > -1 ? empRecords[editIdx]?._record_id : null;

    // ✅ FIXED: three-way save logic
    let res;
    if (existingId) {
      // Normal edit of existing row
      res = await apiCall('update_record', { employee_id: empId, record_id: existingId, record: d });
    } else if (insertAfterSortOrder != null) {
      // Insert at specific position (Add Row Below)
      res = await apiCall('insert_record_at', {
        employee_id: empId,
        record: d,
        after_sort_order: insertAfterSortOrder,
      });
    } else {
      // Normal append to end
      res = await apiCall('save_record', { employee_id: empId, record: d });
    }

    if (!res.ok) { alert('Save failed: ' + (res.error || 'Unknown error')); setSaving(false); return; }

    if (!existingId && res.record_id) d._record_id = res.record_id;
    if (existingId) d._record_id = existingId;

    const newRecords = [...empRecords];
    if (editIdx > -1) newRecords[editIdx] = d; else newRecords.push(d);
    sortRecordsByDate(newRecords);

    if (emp) dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, records: newRecords, lastEditedAt: new Date().toISOString() } });

    const updates = computeRowBalanceUpdates(newRecords, empId, empStatus);
    await Promise.all(updates.map(u => apiCall('save_row_balance', u)));

    setSaving(false);
    setSo(''); setPrd(''); setFrText(''); setToText(''); setFrPick(''); setToPick('');
    setAction(''); setNote(''); setEarned(''); setForce('');
    setMonV(''); setMonS(''); setMonDV(''); setMonDS(''); setMonAmt(''); setMonDis('');
    setTrV(''); setTrS('');
    onSaved();
  }

  const inputH = { height: 'var(--H)', padding: '0 12px', border: '1.5px solid var(--br)', borderRadius: 7, fontSize: 12, background: 'white', color: 'var(--cha)', fontFamily: 'Inter,sans-serif', width: '100%', boxSizing: 'border-box' as const };

  return (
    <div>
      <div className="ig" style={{ marginBottom: 14 }}>

        <div className="f">
          <label>Special Order #</label>
          <input type="text" style={inputH} value={so} onChange={e => setSo(e.target.value)} />
        </div>

        <div className="f">
          <label>Period Covered</label>
          <input type="text" style={inputH} value={prd} onChange={e => setPrd(e.target.value)} />
        </div>

        <div className="f">
          <label>Date From</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="text" style={{ ...inputH, flex: 1 }} placeholder="mm/dd/yyyy" maxLength={10}
              value={frText} onChange={e => handleFromText(e.target.value)} />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button type="button" style={{ height: 'var(--H)', width: 34, border: '1.5px solid var(--br)', borderRadius: 7, background: 'white', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📅</button>
              <input type="date" value={frPick} onChange={e => handleFromChange(e.target.value)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2, border: 'none', padding: 0, margin: 0 }} />
            </div>
          </div>
        </div>

        <div className="f">
          <label>Date To</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="text" style={{ ...inputH, flex: 1 }} placeholder="mm/dd/yyyy" maxLength={10}
              value={toText} onChange={e => handleToText(e.target.value)} />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button type="button" style={{ height: 'var(--H)', width: 34, border: '1.5px solid var(--br)', borderRadius: 7, background: 'white', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📅</button>
              <input type="date" value={toPick} min={frPick} onChange={e => handleToChange(e.target.value)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2, border: 'none', padding: 0, margin: 0 }} />
            </div>
          </div>
        </div>

        <div className="f">
          <label>Nature of Action</label>
          <input list="leaveActionList" style={inputH} value={action}
            onChange={e => setAction(e.target.value)} placeholder="Select or type…" autoComplete="off" />
          <datalist id="leaveActionList">
            {KNOWN_ACTIONS.map(a => <option key={a} value={a} />)}
          </datalist>
        </div>

        <div className="f">
          <label>Additional Note</label>
          <input type="text" style={inputH} value={note}
            onChange={e => setNote(e.target.value)} placeholder="e.g. per CSC MC No. 14" />
        </div>

        <div className="f">
          <label>Value Earned</label>
          <input type="number" style={inputH} step="0.001" value={earned}
            onChange={e => setEarned(e.target.value)} />
        </div>

        {(() => {
          const al = action.toLowerCase();
          const isForceAction = (al.includes('force') || al.includes('mandatory')) && !al.includes('disapproved');
          const isForceDis    = (al.includes('force') || al.includes('mandatory')) &&  al.includes('disapproved');
          if (isForceAction) return (
            <div className="f hl">
              <label>Days Used (Force/Mandatory Leave)</label>
              <input type="number" style={inputH} step="1" min="0" max="5" value={force}
                onChange={e => setForce(e.target.value)} placeholder="e.g. 5" />
            </div>
          );
          if (isForceDis) return (
            <div className="f hl" style={{ background: '#fff8e1', borderRadius: 7, padding: '6px 8px' }}>
              <label style={{ color: '#b45309' }}>📥 Days to Add Back (Force Leave Disapproved)</label>
              <input type="number" style={{ ...inputH, borderColor: '#f59e0b' }} step="1" min="0" value={force}
                onChange={e => setForce(e.target.value)} placeholder="e.g. 5" />
            </div>
          );
          return null;
        })()}
      </div>

      {isMon && (
        <div style={{ marginBottom: 14 }}>
          <div className="sdiv">💰 Monetization — Deduct Amounts</div>
          <div className="ig">
            {empStatus === 'Non-Teaching' ? <>
              <div className="f hl"><label>Amount (Vacation Col)</label><input type="number" style={inputH} step="0.001" value={monV} onChange={e => setMonV(e.target.value)} /></div>
              <div className="f hl"><label>Amount (Sick Col)</label><input type="number" style={inputH} step="0.001" value={monS} onChange={e => setMonS(e.target.value)} /></div>
            </> : <>
              <div className="f hl"><label>Amount to Deduct</label><input type="number" style={inputH} step="0.001" value={monAmt} onChange={e => setMonAmt(e.target.value)} /></div>
            </>}
          </div>
        </div>
      )}

      {isMD && (
        <div style={{ marginBottom: 14 }}>
          <div className="sdiv">🔄 Monetization (Disapproved) — Add Back</div>
          <div className="ig">
            {empStatus === 'Non-Teaching' ? <>
              <div className="f hl"><label>Add-Back (Vacation Col)</label><input type="number" style={inputH} step="0.001" value={monDV} onChange={e => setMonDV(e.target.value)} /></div>
              <div className="f hl"><label>Add-Back (Sick Col)</label><input type="number" style={inputH} step="0.001" value={monDS} onChange={e => setMonDS(e.target.value)} /></div>
            </> : <>
              <div className="f hl"><label>Amount to Add Back</label><input type="number" style={inputH} step="0.001" value={monDis} onChange={e => setMonDis(e.target.value)} /></div>
            </>}
          </div>
        </div>
      )}

      {isTr && (
        <div style={{ marginBottom: 14 }}>
          <div className="sdiv">🔁 Transfer Balance — Initial Credits from Other Organization</div>
          <div className="ig">
            <div className="f hl">
              <label>Vacation Col Balance{empStatus === 'Teaching' ? ' / Balance (T)' : ''}</label>
              <input type="number" style={inputH} step="0.001" value={trV} onChange={e => setTrV(e.target.value)} />
            </div>
            {empStatus === 'Non-Teaching' && (
              <div className="f hl">
                <label>Sick Col Balance</label>
                <input type="number" style={inputH} step="0.001" value={trS} onChange={e => setTrS(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        {(editIdx > -1 || isInsertMode) && (
          <button className="btn b-slt" onClick={onCancelEdit}>✕ Cancel</button>
        )}
        <button className="btn b-pri" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Saving…' : btnLabel}
        </button>
      </div>
    </div>
  );
}
