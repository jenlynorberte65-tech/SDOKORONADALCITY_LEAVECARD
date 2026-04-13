'use client';
import { useState } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall } from '@/lib/api';
import type { Personnel } from '@/types';

export default function LoginScreen() {
  const { dispatch } = useAppStore();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!loginId || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const res = await apiCall('login', { id: loginId, password });
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Incorrect email or password.'); return; }

    if (res.role === 'admin' || res.role === 'encoder') {
      dispatch({ type: 'LOGIN_ADMIN', payload: { name: res.name!, loginId: res.login_id!, isEncoder: res.role === 'encoder' } });
      const dbRes = await apiCall('get_personnel', {}, 'GET');
      if (dbRes.ok && dbRes.data) dispatch({ type: 'SET_DB', payload: dbRes.data });
      dispatch({ type: 'SET_PAGE', payload: 'home' });
      saveSession({ isAdmin: true, isEncoder: res.role === 'encoder', isSchoolAdmin: false, curId: null, page: 'home' });

    } else if (res.role === 'school_admin') {
      dispatch({ type: 'LOGIN_SCHOOL_ADMIN', payload: { name: res.name!, loginId: res.login_id!, dbId: res.db_id! } });
      const dbRes = await apiCall('get_personnel', {}, 'GET');
      if (dbRes.ok && dbRes.data) dispatch({ type: 'SET_DB', payload: dbRes.data });
      dispatch({ type: 'SET_PAGE', payload: 'home' });
      saveSession({ isAdmin: false, isEncoder: false, isSchoolAdmin: true, curId: null, page: 'home', schoolAdminCfg: { id: res.login_id, dbId: res.db_id, name: res.name } });

    } else if (res.role === 'employee') {
      if (res.account_status === 'inactive') { setError('Your account is inactive. Please contact the administrator.'); return; }
      dispatch({ type: 'LOGIN_EMPLOYEE', payload: { curId: res.employee_id! } });
      const dbRes = await apiCall('get_personnel', {}, 'GET');
      if (dbRes.ok && dbRes.data) {
        dispatch({ type: 'SET_DB', payload: dbRes.data });
        const emp = (dbRes.data as Personnel[]).find(e => e.id === res.employee_id);
        if (!emp || emp.account_status === 'inactive') { setError('Account not found or inactive.'); return; }
        const recRes = await apiCall('get_records', { employee_id: res.employee_id! }, 'GET');
        if (recRes.ok) dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: res.employee_id!, records: recRes.records || [] } });
      }
      dispatch({ type: 'SET_PAGE', payload: 'user' });
      saveSession({ isAdmin: false, isEncoder: false, isSchoolAdmin: false, curId: res.employee_id, page: 'user' });
    }
  }

  function saveSession(data: Record<string, unknown>) {
    // ── Clear any stale session first (e.g. from a previous password) ────
    sessionStorage.removeItem('deped_session');
    sessionStorage.setItem('deped_session', JSON.stringify(data));

    // ── Tell App.tsx that LoginScreen already loaded the DB ───────────────
    // This prevents App.tsx restoreSession() from firing a second
    // get_personnel call and racing / overwriting our freshly loaded data.
    sessionStorage.setItem('deped_just_logged_in', '1');
  }

  return (
    <div id="s-login" className="screen active">
      <div className="lw">
        <div className="split">
          {/* Left brand panel */}
          <div className="sl">
            <div className="l-logos">
              <img
                src="https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2019/11/korlogo.jpg"
                alt="SDO Koronadal"
                style={{ width: 72, height: 72 }}
                onError={(e) => {
                  const img = e.currentTarget;
                  img.src = 'https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2020/05/korlogo2.jpg';
                }}
              />
            </div>
            <div className="l-tag">DepEd Region XII</div>
            <h1>Employee Records &amp; HR Management System</h1>
            <p>SDO City of Koronadal — empowering learners, inspiring excellence.</p>
            <div className="l-rule" />
            <small>Secure · Accurate · Efficient</small>
          </div>
          {/* Right login panel */}
          <div className="sr">
            <div className="lfw">
              <h2>Welcome Back</h2>
              <p className="lsub">Sign in to access your records</p>
              <div className="lf">
                <label>Email Address</label>
                <div className="lfi">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="lf">
                <label>Password</label>
                <div className="lfi">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                  <button className="leye" onClick={() => setShowPw(p => !p)} type="button">
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <button className="lbtn" onClick={handleLogin} disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
              {error && <p className="lerr" style={{ display: 'block' }}>{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
