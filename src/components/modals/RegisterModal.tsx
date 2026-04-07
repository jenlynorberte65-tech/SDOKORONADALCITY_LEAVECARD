'use client';
import { useState, useEffect } from 'react';
import { validateEmployeeId, validateDepedEmail } from '@/lib/api';
import { useAppStore } from '@/hooks/useAppStore';
import type { Personnel } from '@/types';

interface Props {
  employee: Personnel | null;
  onClose: () => void;
  onSaved: (emp: Personnel, isNew: boolean) => void;
}

type F = Record<string, string>;

const EMPTY: F = {
  id:'',email:'',password:'',surname:'',given:'',suffix:'',maternal:'',sex:'',civil:'',
  dob:'',pob:'',addr:'',spouse:'',edu:'',elig:'',rating:'',tin:'',pexam:'',dexam:'',
  appt:'',status:'Teaching',account_status:'active',pos:'',school:'',
};

export default function RegisterModal({ employee, onClose, onSaved }: Props) {
  const { state } = useAppStore();
  const [f, setF]           = useState<F>(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = !employee;

  useEffect(() => {
    if (employee) {
      setF({
        id:             employee.id             ?? '',
        email:          employee.email          ?? '',
        password:       employee.password       ?? '',
        surname:        employee.surname        ?? '',
        given:          employee.given          ?? '',
        suffix:         employee.suffix         ?? '',
        maternal:       employee.maternal       ?? '',
        sex:            employee.sex            ?? '',
        civil:          employee.civil          ?? '',
        dob:            employee.dob            ?? '',
        pob:            employee.pob            ?? '',
        addr:           employee.addr           ?? '',
        spouse:         employee.spouse         ?? '',
        edu:            employee.edu            ?? '',
        elig:           employee.elig           ?? '',
        rating:         employee.rating         ?? '',
        tin:            employee.tin            ?? '',
        pexam:          employee.pexam          ?? '',
        dexam:          employee.dexam          ?? '',
        appt:           employee.appt           ?? '',
        status:         employee.status         ?? 'Teaching',
        account_status: employee.account_status ?? 'active',
        pos:            employee.pos            ?? '',
        school:         employee.school         ?? '',
      });
    } else {
      setF({ ...EMPTY });
    }
    setError('');
  }, [employee]);

  function set(k: string, v: string) { setF(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    setError('');

    // ── Validation ────────────────────────────────────────────
    const idErr = validateEmployeeId(f.id);
    if (idErr) { setError(idErr); return; }

    const emailErr = validateDepedEmail(f.email.toLowerCase().trim());
    if (emailErr) { setError(emailErr); return; }

    const required: [string, string][] = [
      ['surname', 'Surname'], ['given', 'Given name'], ['sex', 'Sex'],
      ['status', 'Category'], ['dob', 'Date of Birth'], ['addr', 'Present Address'],
      ['pos', 'Position / Designation'], ['school', 'School / Office Assignment'],
    ];
    for (const [field, label] of required) {
      if (!f[field]?.trim()) { setError(`${label} is required.`); return; }
    }
    if (isNew && !f.password.trim()) { setError('Password is required for new employees.'); return; }

    // Client-side duplicate checks
    if (isNew && state.db.find(e => e.id === f.id)) {
      setError(`Employee ID "${f.id}" is already in use.`); return;
    }
    if (!isNew && f.id !== employee?.id && state.db.find(e => e.id === f.id)) {
      setError(`Employee ID "${f.id}" is already in use by another employee.`); return;
    }
    const originalId = employee?.id ?? f.id;
    const dupEmail = state.db.find(
      e => e.email?.toLowerCase() === f.email.toLowerCase().trim() && e.id !== originalId
    );
    if (dupEmail) { setError(`Email "${f.email}" is already registered to another employee.`); return; }

    // ── Detect status (category) change ───────────────────────
    // We check BEFORE saving so we have both old and new status available.
    const statusChanged = !isNew && employee && employee.status !== f.status;

    // ── Build payload ─────────────────────────────────────────
    const payload = {
      id:             f.id.trim(),
      originalId:     isNew ? null : employee?.id,
      email:          f.email.toLowerCase().trim(),
      password:       f.password,
      surname:        f.surname.trim(),
      given:          f.given.trim(),
      suffix:         f.suffix.trim(),
      maternal:       f.maternal.trim(),
      sex:            f.sex.trim(),
      civil:          f.civil.trim(),
      dob:            f.dob.trim(),
      pob:            f.pob.trim(),
      addr:           f.addr.trim(),
      spouse:         f.spouse.trim(),
      edu:            f.edu.trim(),
      elig:           f.elig.trim(),
      rating:         f.rating.trim(),
      tin:            f.tin.trim(),
      pexam:          f.pexam.trim(),
      dexam:          f.dexam.trim(),
      appt:           f.appt.trim(),
      status:         f.status,
      account_status: f.account_status,
      pos:            f.pos.trim(),
      school:         f.school.trim(),
      records:        [],   // never re-send records on personal info edit
      conversionLog:  employee?.conversionLog ?? [],
    };

    setSaving(true);
    setError('');

    try {
      // ── Save personal info ────────────────────────────────────
      const res = await fetch('/api/save_employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = `Server error: ${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch { /* response wasn't JSON */ }
        setError(errMsg);
        setSaving(false);
        return;
      }

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Save failed. Please try again.');
        setSaving(false);
        return;
      }

      // ── Insert conversion record if category changed ──────────
      // This creates a new era in the leave card with a "Balance Forwarded" row.
      // The last balance of the old era carries forward to the new era.
      if (statusChanged && employee) {
        // Fetch FRESH records from DB — local state balances may be stale
        // because save_row_balance hasn't run yet on the current session.
        let fwdBV = 0;
        let fwdBS = 0;
        try {
          const recRes = await fetch(
            `/api/get_records?employee_id=${encodeURIComponent(originalId)}`
          );
          const recData = await recRes.json();
          if (recData.ok && Array.isArray(recData.records)) {
            // Find the very last non-conversion record
            const freshRecs: Array<{
              _conversion?: boolean;
              setA_balance?: number;
              setB_balance?: number;
            }> = recData.records;
            const lastFresh = [...freshRecs].reverse().find(r => !r._conversion);
            if (lastFresh) {
              fwdBV = lastFresh.setA_balance ?? 0;
              fwdBS = lastFresh.setB_balance ?? 0;
            }
          }
        } catch {
          // fallback to local state if fetch fails
          const lastRec = [...(employee.records ?? [])]
            .reverse()
            .find(r => !r._conversion);
          fwdBV = lastRec?.setA_balance ?? 0;
          fwdBS = lastRec?.setB_balance ?? 0;
        }

        const conversionRecord = {
          so:          '',
          prd:         '',
          from:        '',
          to:          '',
          spec:        '',
          action:      '',
          earned:      0,
          forceAmount: 0,
          monV:        0,
          monS:        0,
          monDV:       0,
          monDS:       0,
          monAmount:   0,
          monDisAmt:   0,
          trV:         0,
          trS:         0,
          _conversion: true,
          fromStatus:  employee.status,          // old category (e.g. "Teaching")
          toStatus:    f.status,                 // new category (e.g. "Non-Teaching")
          date:        new Date().toISOString().slice(0, 10),
          fwdBV,                                 // last Set A balance before conversion
          fwdBS,                                 // last Set B balance before conversion
        };

        await fetch('/api/save_record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: f.id.trim(),
            record:      conversionRecord,
          }),
        });
      }

      // ── Build updated Personnel object for local state ────────
      const saved: Personnel = {
        ...(employee ?? ({} as Personnel)),
        id:             f.id.trim(),
        email:          f.email.toLowerCase().trim(),
        password:       f.password,
        surname:        f.surname.trim(),
        given:          f.given.trim(),
        suffix:         f.suffix.trim(),
        maternal:       f.maternal.trim(),
        sex:            f.sex.trim(),
        civil:          f.civil.trim(),
        dob:            f.dob.trim(),
        pob:            f.pob.trim(),
        addr:           f.addr.trim(),
        spouse:         f.spouse.trim(),
        edu:            f.edu.trim(),
        elig:           f.elig.trim(),
        rating:         f.rating.trim(),
        tin:            f.tin.trim(),
        pexam:          f.pexam.trim(),
        dexam:          f.dexam.trim(),
        appt:           f.appt.trim(),
        status:         f.status as 'Teaching' | 'Non-Teaching',
        account_status: f.account_status as 'active' | 'inactive',
        pos:            f.pos.trim(),
        school:         f.school.trim(),
        lastEditedAt:   new Date().toISOString(),
        records:        employee?.records      ?? [],
        conversionLog:  employee?.conversionLog ?? [],
      };

      onSaved(saved, isNew);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setError('Network error: Could not reach the server. Please check your connection and try again.');
      } else {
        setError(`Unexpected error: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const fi = (label: string, key: string, type = 'text', span?: number, hint?: string) => (
    <div className="f" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>{label}{hint && <span style={{ color: '#e53e3e', fontSize: 10 }}> {hint}</span>}</label>
      <input
        type={type}
        value={f[key] || ''}
        onChange={e => {
          let v = e.target.value;
          if (key === 'id')    v = v.replace(/\D/g, '').slice(0, 8);
          if (key === 'email') v = v.toLowerCase();
          set(key, v);
        }}
        placeholder={
          key === 'id'    ? 'e.g. 20240001' :
          key === 'email' ? 'juan@deped.gov.ph' : ''
        }
        maxLength={key === 'id' ? 8 : undefined}
      />
      {key === 'email' && f.email && !f.email.endsWith('@deped.gov.ph') && (
        <span style={{ fontSize: 10, color: '#e53e3e' }}>⚠️ Must end with @deped.gov.ph</span>
      )}
    </div>
  );

  return (
    <div className="mo open">
      <div className="mb">
        <div className="mh">
          <h3>{isNew ? 'Register New Personnel' : 'Edit Personnel Details'}</h3>
          <button className="btn b-slt b-sm" onClick={onClose}>✕ Close</button>
        </div>

        <div className="md">
          {/* Account Credentials */}
          <div className="sdiv">Account Credentials</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Employee id (7 digits)', 'id', 'text', undefined, isNew ? '*' : undefined)}
            {fi('Email Address (@deped.gov.ph)', 'email', 'email', undefined, '*')}
            <div className="f">
              <label>
                Password
                {isNew && <span style={{ color: '#e53e3e', fontSize: 10 }}> *</span>}
              </label>
              <div className="ew">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={f.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder={isNew ? 'Enter password' : 'Leave blank to keep current'}
                />
                <button className="eye-btn" type="button" onClick={() => setShowPw(p => !p)}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="sdiv">Personal Information</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Surname',         'surname',  'text', undefined, '*')}
            {fi('Given Name',      'given',    'text', undefined, '*')}
            {fi('Suffix (Jr/III)', 'suffix')}
            {fi('Maternal Surname','maternal')}
            <div className="f">
              <label>Sex <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label>
              <input list="sexList" value={f.sex} onChange={e => set('sex', e.target.value)}
                placeholder="Select or type…"
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif' }} />
              <datalist id="sexList"><option value="Male"/><option value="Female"/></datalist>
            </div>
            <div className="f">
              <label>Civil Status</label>
              <input list="civList" value={f.civil} onChange={e => set('civil', e.target.value)}
                placeholder="Select or type…"
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif' }} />
              <datalist id="civList">
                <option value="Single"/><option value="Married"/><option value="Widowed"/>
                <option value="Solo Parent"/><option value="Separated"/><option value="Annulled"/>
              </datalist>
            </div>
            {fi('Date of Birth',   'dob',  'date', undefined, '*')}
            {fi('Place of Birth',  'pob')}
            {fi('Present Address', 'addr', 'text', 2, '*')}
            {fi('Name of Spouse',  'spouse','text', 2)}
          </div>

          {/* Educational & Civil Service */}
          <div className="sdiv">Educational &amp; Civil Service</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Educational Qualification',        'edu',   'text', 2)}
            {fi('C.S. Eligibility (Kind of Exam)',  'elig',  'text', 2)}
            {fi('Rating',     'rating')}
            {fi('TIN Number', 'tin')}
            {fi('Place of Exam', 'pexam')}
            {fi('Date of Exam',               'dexam','date')}
            {fi('Date of Original Appointment','appt', 'date')}
          </div>

          {/* Employment Details */}
          <div className="sdiv">Employment Details</div>

          {/* ── Conversion warning ── */}
          {!isNew && employee && f.status !== employee.status && (
            <div style={{ margin: '0 0 14px', padding: '10px 14px', background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 8 }}>
              <p style={{ color: '#92400e', fontSize: 12, fontWeight: 600, margin: 0 }}>
                ⚠️ Category change detected: <b>{employee.status}</b> → <b>{f.status}</b>
                <br />
                <span style={{ fontWeight: 400 }}>
                  A new leave card era will be created. The current balance will be carried forward as the opening balance of the new era.
                </span>
              </p>
            </div>
          )}

          <div className="ig">
            <div className="f">
              <label>Category <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label>
              <input list="statList" value={f.status} onChange={e => set('status', e.target.value)}
                placeholder="Select or type…"
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif' }} />
              <datalist id="statList"><option value="Teaching"/><option value="Non-Teaching"/></datalist>
            </div>
            <div className="f">
              <label>Account Status</label>
              <select value={f.account_status} onChange={e => set('account_status', e.target.value)}
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif',appearance:'none' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {fi('Position / Designation',      'pos',   'text', undefined, '*')}
            {fi('School / Office Assignment',  'school','text', 2, '*')}
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8 }}>
              <p style={{ color: '#c53030', fontSize: 12, fontWeight: 600, margin: 0 }}>⚠️ {error}</p>
            </div>
          )}
        </div>

        <div className="mf">
          <button className="btn b-slt" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn b-grn" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
