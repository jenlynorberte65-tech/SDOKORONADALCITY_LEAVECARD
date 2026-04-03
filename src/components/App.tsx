'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import LoginScreen from '@/components/LoginScreen';
import AppScreen from '@/components/AppScreen';
import { apiCall } from '@/lib/api';

export default function App() {
  const { state, dispatch } = useAppStore();

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('deped_session');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.isSchoolAdmin && s.schoolAdminCfg) {
        dispatch({ type: 'LOGIN_SCHOOL_ADMIN', payload: { name: s.schoolAdminCfg.name, loginId: s.schoolAdminCfg.id, dbId: s.schoolAdminCfg.dbId } });
        loadDB().then(() => dispatch({ type: 'SET_PAGE', payload: 'sa' }));
      } else if (s.isAdmin) {
        dispatch({ type: 'LOGIN_ADMIN', payload: { name: s.isEncoder ? 'Encoder' : 'Administrator', loginId: '', isEncoder: s.isEncoder || false } });
        apiCall('get_admin_cfg', {}, 'GET').then(res => {
          if (res.ok) dispatch({ type: 'SET_ADMIN_CFG', payload: { admin: res.admin ?? undefined, encoder: res.encoder ?? undefined } });
        });
       loadDB().then(async () => {
  const restoredPage = s.page || 'list';
  if (s.curId && (restoredPage === 'nt' || restoredPage === 't')) {
    dispatch({ type: 'SET_CUR_ID', payload: s.curId });
    try {
      const recRes = await apiCall('get_records', { employee_id: s.curId }, 'GET');
      if (recRes.ok && recRes.records) {
        dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: s.curId, records: recRes.records } });
      }
    } catch { /* ignore */ }
  } else if (s.curId) {
    dispatch({ type: 'SET_CUR_ID', payload: s.curId });
  }
  dispatch({ type: 'SET_PAGE', payload: restoredPage });
});
      } else if (s.curId) {
        dispatch({ type: 'LOGIN_EMPLOYEE', payload: { curId: s.curId } });
        loadDB();
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDB() {
    dispatch({ type: 'SET_LOADING', payload: true });
    const res = await apiCall('get_personnel', {}, 'GET');
    if (res.ok && res.data) dispatch({ type: 'SET_DB', payload: res.data });
    dispatch({ type: 'SET_LOADING', payload: false });
  }

  const loggedIn = state.isAdmin || state.isSchoolAdmin || state.role === 'employee';

  return (
    <div>
      {!loggedIn && <LoginScreen />}
      {loggedIn  && <AppScreen />}
    </div>
  );
}
