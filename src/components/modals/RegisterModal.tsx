'use client';
import { useState, useEffect } from 'react';
import { apiCall, validateEmployeeId, validateDepedEmail, fmtDateInput, toISODate } from '@/lib/api';
import { useAppStore } from '@/hooks/useAppStore';
import type { Personnel } from '@/types';

interface Props {
  employee: Personnel | null;
  onClose: () => void;
  onSaved: (emp: Personnel, isNew: boolean) => void;
}

const LEAVE_ACTIONS = ['Vacation Leave','Mandatory/Force Leave','Sick Leave','Personal Leave',
  'Compensatory Time Off (CTO)','Maternity Leave','Paternity Leave','Special Privilege Leave (SPL)',
  'Solo Parent Leave','Study Leave','Rehabilitation Leave','Wellness Leave',
  'Special Leave Benefits for Women (Magna Carta)','Violence Against Women and Children (VAWC) Leave',
  'Terminal Leave','Monetization','Monetization (disapproved)','Force Leave (disapproved)','From DENR Region 12'];

type F = Record<string, string>;

const EMPTY: F = {
  id:'',email:'',password:'',surname:'',given:'',suffix:'',maternal:'',sex:'',civil:'',
  dob:'',pob:'',addr:'',spouse:'',edu:'',elig:'',rating:'',tin:'',pexam:'',dexam:'',
  appt:'',status:'Teaching',account_status:'active',pos:'',school:'',
};

export default function RegisterModal({ employee, onClose, onSaved }: Props) {
  const { state } = useAppStore();
  const [f, setF]       = useState<F>(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = !employee;

  useEffect(() => {
    if (employee) {
      setF({
        id:             employee.id,
        email:          employee.email || '',
        password:       employee.password || '',
        surname:        employee.surname || '',
        given:          employee.given || '',
        suffix:         employee.suffix || '',
        maternal:       employee.maternal || '',
        sex:            employee.sex || '',
        civil:          employee.civil || '',
        dob:            employee.dob || '',
        pob:            employee.pob || '',
        addr:           employee.addr || '',
        spouse:         employee.spouse || '',
        edu:            employee.edu || '',
        elig:           employee.elig || '',
        rating:         employee.rating || '',
        tin:            employee.tin || '',
        pexam:          employee.pexam || '',
        dexam:          employee.dexam || '',
        appt:           employee.appt || '',
        status:         employee.status || 'Teaching',
        account_status: employee.account_status || 'active',
        pos:            employee.pos || '',
        school:         employee.school || '',
      });
    } else {
      setF({ ...EMPTY });
    }
    setError('');
  }, [employee]);

  function set(k: string, v: string) { setF(prev => ({ ...prev, [k]: v })); }

  function enforceDepedEmail(val: string) {
    set('email', val);
  }

  async function handleSave() {
    setError('');
    // Validate
    const idErr = validateEmployeeId(f.id);
    if (idErr) { setError(idErr); return; }
    const emailErr = validateDepedEmail(f.email.toLowerCase().trim());
    if (emailErr) { setError(emailErr); return; }
    const required: [string, string][] = [
      ['surname','Surname'],['given','Given name'],['sex','Sex'],
      ['status','Category'],['dob','Date of Birth'],['addr','Present Address'],
      ['pos','Position / Designation'],['school','School / Office Assignment'],
    ];
    for (const [field, label] of required) {
      if (!f[field]?.trim()) { setError(`${label} is required.`); return; }
    }
    if (isNew && !f.password) { setError('Password is required for new employees.'); return; }
    // Duplicate ID check
    if (isNew) {
      const dup = state.db.find(e => e.id === f.id);
      if (dup) { setError(`Employee ID "${f.id}" is already in use.`); return; }
    }
    // Duplicate email check
    const dupEmail = state.db.find(e => e.email?.toLowerCase() === f.email.toLowerCase() && e.id !== f.id);
    if (dupEmail) { setError(`Email "${f.email}" is already registered to another employee.`); return; }

    setSaving(true);
    // Build payload with existing records for conversion support
    const payload = {
      ...f,
      records: employee?.records || [],
      conversionLog: employee?.conversionLog || [],
    };
    const res = await apiCall('save_employee', payload);
    setSaving(false);
    if (!res.ok) { setError(res.error || 'Save failed.'); return; }

    const saved: Personnel = {
      ...(employee || {} as Personnel),
      id: f.id, email: f.email, password: f.password,
      surname: f.surname, given: f.given, suffix: f.suffix,
      maternal: f.maternal, sex: f.sex, civil: f.civil,
      dob: f.dob, pob: f.pob, addr: f.addr, spouse: f.spouse,
      edu: f.edu, elig: f.elig, rating: f.rating, tin: f.tin,
      pexam: f.pexam, dexam: f.dexam, appt: f.appt,
      status: f.status as 'Teaching' | 'Non-Teaching',
      account_status: f.account_status as 'active' | 'inactive',
      pos: f.pos, school: f.school,
      lastEditedAt: new Date().toISOString(),
      records: employee?.records || [],
      conversionLog: employee?.conversionLog || [],
    };
    onSaved(saved, isNew);
  }

  const fi = (label: string, key: string, type: string = 'text', span?: number, hint?: string) => (
    <div className="f" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>{label}{hint && <span style={{ color: '#e53e3e', fontSize: 10 }}> {hint}</span>}</label>
      <input
        type={type}
        value={f[key] || ''}
        onChange={e => {
          let v = e.target.value;
          if (key === 'id') v = v.replace(/\D/g, '').slice(0, 8);
          if (key === 'email') enforceDepedEmail(v);
          else set(key, v);
        }}
        placeholder={key === 'id' ? 'e.g. 20240001' : key === 'email' ? 'juan@deped.gov.ph' : ''}
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
          <h3>Personnel Registration &amp; Update</h3>
          <button className="btn b-slt b-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div className="md">
          {/* Account Credentials */}
          <div className="sdiv">Account Credentials</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Employee ID (8 digits)', 'id', 'text', undefined, '*')}
            {fi('Email Address (@deped.gov.ph)', 'email', 'email', undefined, '*')}
            <div className="f">
              <label>Password{isNew && <span style={{ color: '#e53e3e', fontSize: 10 }}> *</span>}</label>
              <div className="ew">
                <input type={showPw ? 'text' : 'password'} value={f.password} onChange={e => set('password', e.target.value)} placeholder={isNew ? 'Enter password' : 'Leave blank to keep current'} />
                <button className="eye-btn" type="button" onClick={() => setShowPw(p => !p)}>{showPw ? '🙈' : '👁'}</button>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="sdiv">Personal Information</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Surname', 'surname', 'text', undefined, '*')}
            {fi('Given Name', 'given', 'text', undefined, '*')}
            {fi('Suffix (Jr/III)', 'suffix')}
            {fi('Maternal Surname', 'maternal')}
            <div className="f">
              <label>Sex <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label>
              <input list="sexList" value={f.sex} onChange={e => set('sex', e.target.value)} placeholder="Select or type…" style={{ height: 'var(--H)', padding: '0 12px', border: '1.5px solid var(--br)', borderRadius: 7, fontSize: 12, width: '100%', background: 'white', color: 'var(--cha)', fontFamily: 'Inter,sans-serif' }} />
              <datalist id="sexList"><option value="Male" /><option value="Female" /></datalist>
            </div>
            <div className="f">
              <label>Civil Status</label>
              <input list="civList" value={f.civil} onChange={e => set('civil', e.target.value)} placeholder="Select or type…" style={{ height: 'var(--H)', padding: '0 12px', border: '1.5px solid var(--br)', borderRadius: 7, fontSize: 12, width: '100%', background: 'white', color: 'var(--cha)', fontFamily: 'Inter,sans-serif' }} />
              <datalist id="civList"><option value="Single" /><option value="Married" /><option value="Widowed" /><option value="Solo Parent" /><option value="Separated" /><option value="Annulled" /></datalist>
            </div>
            {fi('Date of Birth', 'dob', 'date', undefined, '*')}
            {fi('Place of Birth', 'pob')}
            {fi('Present Address', 'addr', 'text', 2, '*')}
            {fi('Name of Spouse', 'spouse', 'text', 2)}
          </div>

          {/* Educational & Civil Service */}
          <div className="sdiv">Educational &amp; Civil Service</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Educational Qualification', 'edu', 'text', 2)}
            {fi('C.S. Eligibility (Kind of Exam)', 'elig', 'text', 2)}
            {fi('Rating', 'rating')}
            {fi('TIN Number', 'tin')}
            {fi('Place of Exam', 'pexam')}
            {fi('Date of Exam', 'dexam', 'date')}
            {fi('Date of Original Appointment', 'appt', 'date')}
          </div>

          {/* Employment Details */}
          <div className="sdiv">Employment Details</div>
          <div className="ig">
            <div className="f">
              <label>Category <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label>
              <input list="statList" value={f.status} onChange={e => set('status', e.target.value)} placeholder="Select or type…" style={{ height: 'var(--H)', padding: '0 12px', border: '1.5px solid var(--br)', borderRadius: 7, fontSize: 12, width: '100%', background: 'white', color: 'var(--cha)', fontFamily: 'Inter,sans-serif' }} />
              <datalist id="statList"><option value="Teaching" /><option value="Non-Teaching" /></datalist>
            </div>
            <div className="f">
              <label>Account Status</label>
              <select value={f.account_status} onChange={e => set('account_status', e.target.value)} style={{ height: 'var(--H)', padding: '0 12px', border: '1.5px solid var(--br)', borderRadius: 7, fontSize: 12, width: '100%', background: 'white', color: 'var(--cha)', fontFamily: 'Inter,sans-serif', appearance: 'none' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {fi('Position / Designation', 'pos', 'text', undefined, '*')}
            {fi('School / Office Assignment', 'school', 'text', 2, '*')}
          </div>

          {error && <p style={{ color: 'var(--rd)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>⚠️ {error}</p>}
        </div>
        <div className="mf">
          <button className="btn b-slt" onClick={onClose}>Cancel</button>
          <button className="btn b-grn" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
