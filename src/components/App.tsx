'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import LoginScreen from '@/components/LoginScreen';
import AppScreen from '@/components/AppScreen';
import { apiCall } from '@/lib/api';
import type { Personnel } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
//  App.tsx — Root component
//
//  HOW SESSION RESTORE WORKS (and why it won't double-load):
//
//  - On fresh login: LoginScreen handles everything (dispatch + loadDB).
//    It sets a module-level flag `justLoggedIn` so restoreSession() skips.
//    This flag lives in JS memory only — it dies on page refresh. ✅
//
//  - On page refresh: flag is gone, restoreSession() reads sessionStorage
//    and restores the session + reloads the DB normally. ✅
//
//  - On logout: sessionStorage is cleared, restoreSession() finds nothing. ✅
// ─────────────────────────────────────────────────────────────────────────────

// Module-level flag — survives re-renders but resets on page refresh.
// Set by LoginScreen, consumed once by restoreSession().
export let justLoggedIn = false;
export function setJustLoggedIn() { justLoggedIn = true; }

// ── Shared paginated loader — fetches all personnel in 100-record chunks ─────
// This prevents the browser OOM crash caused by loading everything at once.
export async function fetchAllPersonnel(): Promise<Personnel[]> {
  const all: Personnel[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const res = await apiCall(`get_personnel?page=${page}&limit=${limit}`, {}, 'GET');
    if (!res.ok || !res.data) break;
    all.push(...(res.data as Personnel[]));
    if (all.length >= (res.total ?? all.length)) break; // no more pages
    page++;
  }

  return all;
}

export default function App() {
  const { state, dispatch } = useAppStore();

  useEffect(() => {
    async function restoreSession() {
      try {
        // ── Skip if LoginScreen just handled login this session ───────────
        if (justLoggedIn) {
          justLoggedIn = false; // consume the flag
          return;
        }

        const raw = sessionStorage.getItem('deped_session');
        if (!raw) return;
        const s = JSON.parse(raw);

        if (s.isSchoolAdmin && s.schoolAdminCfg) {
          dispatch({
            type: 'LOGIN_SCHOOL_ADMIN',
            payload: {
              name:    s.schoolAdminCfg.name,
              loginId: s.schoolAdminCfg.id,
              dbId:    s.schoolAdminCfg.dbId,
            },
          });
          await loadDB();
          const savedPage = s.page || 'home';
          dispatch({ type: 'SET_PAGE', payload: savedPage as never });

        } else if (s.isAdmin) {
          dispatch({
            type: 'LOGIN_ADMIN',
            payload: {
              name:      s.isEncoder ? 'Encoder' : 'Administrator',
              loginId:   '',
              isEncoder: s.isEncoder || false,
            },
          });
          apiCall('get_admin_cfg', {}, 'GET').then(res => {
            if (res.ok)
              dispatch({
                type: 'SET_ADMIN_CFG',
                payload: {
                  admin:   res.admin   ?? undefined,
                  encoder: res.encoder ?? undefined,
                },
              });
          });
          await loadDB();
          // Restore page — if on nt/t card, also reload records
          const page = s.page || 'home';
          if ((page === 'nt' || page === 't') && s.curId) {
            dispatch({ type: 'SET_CUR_ID', payload: s.curId });
            const res = await apiCall('get_records', { employee_id: s.curId }, 'GET');
            if (res.ok && res.records) {
              dispatch({
                type: 'SET_EMPLOYEE_RECORDS',
                payload: { id: s.curId, records: res.records },
              });
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

  // ── Paginated DB loader — replaces the old single-request loadDB ──────────
  async function loadDB() {
    dispatch({ type: 'SET_LOADING', payload: true });
    const personnel = await fetchAllPersonnel();
    if (personnel.length) dispatch({ type: 'SET_DB', payload: personnel });
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
