'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import LoginScreen from '@/components/LoginScreen';
import AppScreen from '@/components/AppScreen';
import { apiCall } from '@/lib/api';

export default function App() {
  const { state, dispatch } = useAppStore();

  useEffect(() => {
    async function restoreSession() {
      try {
        const raw = sessionStorage.getItem('deped_session');
        if (!raw) return;
        const s = JSON.parse(raw);

        if (s.isSchoolAdmin && s.schoolAdminCfg) {
          dispatch({ type: 'LOGIN_SCHOOL_ADMIN', payload: { name: s.schoolAdminCfg.name, loginId: s.schoolAdminCfg.id, dbId: s.schoolAdminCfg.dbId } });
          await loadDB();
          dispatch({ type: 'SET_PAGE', payload: 'sa' });

        } else if (s.isAdmin) {
          dispatch({ type: 'LOGIN_ADMIN', payload: { name: s.isEncoder ? 'Encoder' : 'Administrator', loginId: '', isEncoder: s.isEncoder || false } });
          apiCall('get_admin_cfg', {}, 'GET').then(res => {
            if (res.ok) dispatch({ type: 'SET_ADMIN_CFG', payload: { admin: res.admin ?? undefined, encoder: res.encoder ?? undefined } });
          });
          await loadDB();

          // Restore page — if on nt/t card, also reload records for that employee
          const page = s.page || 'list';
          if ((page === 'nt' || page === 't') && s.curId) {
            dispatch({ type: 'SET_CUR_ID', payload: s.curId });
            const res = await apiCall('get_records', { employee_id: s.curId }, 'GET');
            if (res.ok && res.records) {
              dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: s.curId, records: res.records } });
            }
          }
          dispatch({ type: 'SET_PAGE', payload: page as never });

        } else if (s.curId) {
          dispatch({ type: 'LOGIN_EMPLOYEE', payload: { curId: s.curId } });
          await loadDB();
        }
      } catch { /* ignore */ }
    }
    restoreSession();
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
