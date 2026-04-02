'use client';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall, validateDepedEmail } from '@/lib/api';
import type { SchoolAdminAccount } from '@/types';

export default function AdminProfileModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppStore();

  // Admin fields
  const [apName, setApName]   = useState('');
  const [apID,   setApID]     = useState('');
  const [apPw,   setApPw]     = useState('');
  const [apPw2,  setApPw2]    = useState('');
  const [showApPw,  setShowApPw]  = useState(false);
  const [showApPw2, setShowApPw2] = useState(false);
  // Encoder fields
  const [encName, setEncName] = useState('');
  const [encID,   setEncID]   = useState('');
  const [encPw,   setEncPw]   = useState('');
  const [showEncPw, setShowEncPw] = useState(false);
  // Error
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  // School Admin accounts
  const [saAccounts, setSaAccounts] = useState<SchoolAdminAccount[]>([]);
  const [saFormOpen, setSaFormOpen] = useState(false);
  const [saDbId, setSaDbId]         = useState(0);
  const [saName, setSaName]         = useState('');
  const [saEmail, setSaEmail]       = useState('');
  const [saPw, setSaPw]             = useState('');
  const [saError, setSaError]       = useState('');
  const [showSaPw, setShowSaPw]     = useState(false);
  const [saTitle, setSaTitle]       = useState('➕ New School Admin');

  useEffect(() => {
    setApName(state.adminCfg.name || '');
    setApID(state.adminCfg.id || '');
    setApPw(''); setApPw2('');
    setEncName(state.encoderCfg.name || '');
    setEncID(state.encoderCfg.id || '');
    setEncPw('');
    setError('');
    loadSAAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSAAccounts() {
    const res = await apiCall('get_school_admins', {}, 'GET');
    if (res.ok) setSaAccounts(res.school_admins || []);
  }

  async function handleSave() {
    setError('');
    if (!apName) { setError('Admin display name cannot be empty.'); return; }
    const emailErr = validateDepedEmail(apID.toLowerCase().trim());
    if (emailErr) { setError(emailErr); return; }
    if (apPw || apPw2) {
      if (apPw !== apPw2) { setError('Passwords do not match.'); return; }
      if (apPw.length < 4) { setError('Min 4 characters.'); return; }
    }
    if (encID) {
      const encEmailErr = validateDepedEmail(encID.toLowerCase().trim());
      if (encEmailErr) { setError(encEmailErr); return; }
    }
    setSaving(true);
    const res = await apiCall('save_admin', {
      name: apName, login_id: apID, ...(apPw ? { password: apPw } : {}),
      ...(encName ? { enc_name: encName } : {}),
      ...(encID   ? { enc_login_id: encID } : {}),
      ...(encPw && encPw.length >= 4 ? { enc_password: encPw } : {}),
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || 'Save failed.'); return; }
    dispatch({ type: 'SET_ADMIN_CFG', payload: { admin: { name: apName, id: apID }, encoder: { name: encName, id: encID } } });
    onClose();
  }

  function openSaForm(id: number) {
    const sa = id > 0 ? saAccounts.find(x => x.id === id) : null;
    setSaDbId(id);
    setSaTitle(id > 0 ? `✏️ Edit: ${sa?.name || ''}` : '➕ New School Admin');
    setSaName(sa?.name || '');
    setSaEmail(sa?.login_id || '');
    setSaPw('');
    setSaError('');
    setSaFormOpen(true);
  }

  async function saveSaForm() {
    setSaError('');
    if (!saName) { setSaError('Display name is required.'); return; }
    const emailErr = validateDepedEmail(saEmail.toLowerCase().trim());
    if (emailErr) { setSaError(emailErr); return; }
    if (saDbId === 0 && !saPw) { setSaError('Password is required for new accounts.'); return; }
    const res = await apiCall('save_school_admin', { sa_id: saDbId, name: saName, login_id: saEmail, ...(saPw ? { password: saPw } : {}) });
    if (!res.ok) { setSaError(res.error || 'Save failed.'); return; }
    setSaFormOpen(false);
    loadSAAccounts();
  }

  async function deleteSaAccount(id: number, name: string) {
    if (!confirm(`Delete school admin account for "${name}"?\nThis cannot be undone.`)) return;
    const res = await apiCall('delete_school_admin', { sa_id: id });
    if (!res.ok) { alert('Delete failed: ' + (res.error || 'Unknown error')); return; }
    loadSAAccounts();
  }

  const inputStyle = { height: 'var(--H)', padding: '0 12px', border: '1.5px solid var(--br)', borderRadius: 7, fontSize: 12, width: '100%', background: 'white', color: 'var(--cha)', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' as const };

  return (
    <div className="mo open">
      <div className="mb" style={{ maxWidth: 560 }}>
        <div className="mh">
          <h3>⚙️ Admin Profile &amp; Account Settings</h3>
          <button className="btn b-slt b-sm" onClick={onClose}>✕</button>
        </div>
        <div className="md" style={{ padding: '18px 24px 10px' }}>

          {/* ── Admin section ── */}
          <div style={{ border: '1.5px solid #1a5c42', borderRadius: 10, padding: 16, marginBottom: 16, background: 'linear-gradient(135deg,#f0fff4,#e6ffed)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--g1),var(--g2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>👑</div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--g1)' }}>Administrator Account</div><div style={{ fontSize: 10, color: 'var(--mu)' }}>Full system access — leave cards, personnel, settings</div></div>
            </div>
            <div className="ig" style={{ rowGap: 10 }}>
              <div className="f" style={{ gridColumn: 'span 2' }}><label>Display Name</label><input style={inputStyle} value={apName} onChange={e => setApName(e.target.value)} /></div>
              <div className="f" style={{ gridColumn: 'span 2' }}><label>Login Email <span style={{ color: '#e53e3e', fontSize: 10 }}>(@deped.gov.ph)</span></label><input type="email" style={inputStyle} value={apID} onChange={e => setApID(e.target.value)} placeholder="admin@deped.gov.ph" /></div>
              <div className="f"><label>New Password <span style={{ color: 'var(--mu)', fontSize: 10 }}>(blank = keep)</span></label><div className="ew"><input type={showApPw ? 'text' : 'password'} style={inputStyle} value={apPw} onChange={e => setApPw(e.target.value)} /><button className="eye-btn" type="button" onClick={() => setShowApPw(p => !p)}>{showApPw ? '🙈' : '👁'}</button></div></div>
              <div className="f"><label>Confirm Password</label><div className="ew"><input type={showApPw2 ? 'text' : 'password'} style={inputStyle} value={apPw2} onChange={e => setApPw2(e.target.value)} /><button className="eye-btn" type="button" onClick={() => setShowApPw2(p => !p)}>{showApPw2 ? '🙈' : '👁'}</button></div></div>
            </div>
          </div>

          {/* ── Encoder section ── */}
          <div style={{ border: '1.5px solid var(--nb)', borderRadius: 10, padding: 16, marginBottom: 16, background: 'linear-gradient(135deg,#eff6ff,#dbeafe)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1e3a6e,#2d5a9e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>✏️</div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a6e' }}>Encoder Account</div><div style={{ fontSize: 10, color: 'var(--mu)' }}>Can edit leave cards and personnel records</div></div>
            </div>
            <div className="ig" style={{ rowGap: 10 }}>
              <div className="f" style={{ gridColumn: 'span 2' }}><label>Display Name</label><input style={inputStyle} value={encName} onChange={e => setEncName(e.target.value)} placeholder="Records Encoder" /></div>
              <div className="f" style={{ gridColumn: 'span 2' }}><label>Login Email <span style={{ color: '#e53e3e', fontSize: 10 }}>(@deped.gov.ph)</span></label><input type="email" style={inputStyle} value={encID} onChange={e => setEncID(e.target.value)} placeholder="encoder@deped.gov.ph" /></div>
              <div className="f" style={{ gridColumn: 'span 2' }}><label>New Password <span style={{ color: 'var(--mu)', fontSize: 10 }}>(blank = keep)</span></label><div className="ew"><input type={showEncPw ? 'text' : 'password'} style={inputStyle} value={encPw} onChange={e => setEncPw(e.target.value)} /><button className="eye-btn" type="button" onClick={() => setShowEncPw(p => !p)}>{showEncPw ? '🙈' : '👁'}</button></div></div>
            </div>
          </div>

          {/* ── School Admin section ── */}
          <div style={{ border: '1.5px solid #7c3aed', borderRadius: 10, padding: 16, marginBottom: 4, background: 'linear-gradient(135deg,#faf5ff,#ede9fe)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🏫</div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>School Admin Accounts</div><div style={{ fontSize: 10, color: 'var(--mu)' }}>Can register &amp; edit personnel only — no leave card access</div></div>
            </div>
            {/* List */}
            <div style={{ marginBottom: 12 }}>
              {saAccounts.length === 0 ? (
                <p style={{ fontSize: 11.5, color: '#7c3aed', fontStyle: 'italic', padding: '4px 0 8px' }}>No school admin accounts yet. Add one below.</p>
              ) : saAccounts.map(sa => (
                <div key={sa.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'white', border: '1px solid #ddd6fe', borderRadius: 8, marginBottom: 7 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{(sa.name || 'S')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5b21b6' }}>{sa.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sa.login_id}</div>
                  </div>
                  <button className="btn b-sm" style={{ background: '#7c3aed', color: 'white', flexShrink: 0 }} onClick={() => openSaForm(sa.id)}>✏ Edit</button>
                  <button className="btn b-sm b-red" style={{ flexShrink: 0 }} onClick={() => deleteSaAccount(sa.id, sa.name)}>🗑</button>
                </div>
              ))}
            </div>
            {/* Inline form */}
            {saFormOpen && (
              <div style={{ background: 'white', border: '1.5px dashed #a855f7', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5b21b6', marginBottom: 10 }}>{saTitle}</div>
                <div className="ig" style={{ rowGap: 10 }}>
                  <div className="f" style={{ gridColumn: 'span 2' }}><label>Display Name <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label><input style={inputStyle} value={saName} onChange={e => setSaName(e.target.value)} placeholder="e.g. Juan Dela Cruz" /></div>
                  <div className="f" style={{ gridColumn: 'span 2' }}><label>Login Email <span style={{ color: '#e53e3e', fontSize: 10 }}>(@deped.gov.ph) *</span></label><input type="email" style={inputStyle} value={saEmail} onChange={e => setSaEmail(e.target.value)} placeholder="schooladmin@deped.gov.ph" /></div>
                  <div className="f" style={{ gridColumn: 'span 2' }}>
                    <label>{saDbId > 0 ? <>New Password <span style={{ color: 'var(--mu)', fontSize: 10 }}>(blank = keep)</span></> : <>Password <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></>}</label>
                    <div className="ew"><input type={showSaPw ? 'text' : 'password'} style={inputStyle} value={saPw} onChange={e => setSaPw(e.target.value)} /><button className="eye-btn" type="button" onClick={() => setShowSaPw(p => !p)}>{showSaPw ? '🙈' : '👁'}</button></div>
                  </div>
                </div>
                {saError && <p style={{ color: 'var(--rd)', fontSize: 11, marginTop: 8 }}>{saError}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn b-slt b-sm" onClick={() => setSaFormOpen(false)}>Cancel</button>
                  <button className="btn b-sm" style={{ background: '#7c3aed', color: 'white' }} onClick={saveSaForm}>💾 Save Account</button>
                </div>
              </div>
            )}
            {!saFormOpen && (
              <button className="btn b-sm" style={{ background: '#7c3aed', color: 'white' }} onClick={() => openSaForm(0)}>➕ Add School Admin</button>
            )}
          </div>

          {error && <p style={{ color: 'var(--rd)', fontSize: 11.5, display: 'block', marginTop: 8 }}>{error}</p>}
        </div>
        <div className="mf" style={{ gap: 10 }}>
          <button className="btn b-slt" onClick={onClose}>Cancel</button>
          <button className="btn b-pri" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving…' : '💾 Save Admin & Encoder'}</button>
        </div>
      </div>
    </div>
  );
}
