'use client';
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { Topbar, Sidebar } from '@/components/Navigation';
import AdminProfileModal from '@/components/modals/AdminProfileModal';
import HomepagePage from '@/components/pages/HomepagePage';
import PersonnelListPage from '@/components/pages/PersonnelListPage';
import LeaveCardsPage from '@/components/pages/LeaveCardsPage';
import SchoolAdminPage from '@/components/pages/SchoolAdminPage';
import UserPage from '@/components/pages/UserPage';
import NTCardPage from '@/components/pages/NTCardPage';
import TCardPage from '@/components/pages/TCardPage';
import { apiCall } from '@/lib/api';
import type { Personnel } from '@/types';

export default function AppScreen() {
  const { state, dispatch } = useAppStore();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const isEmployee = state.role === 'employee';

  // ── Pre-load every employee's records immediately after login ──────────
  // This ensures the dashboard's Updated / Not-Yet-Updated badges are
  // accurate the moment the user lands on the home page — without needing
  // to visit the Leave Cards section first.
  const preloadedRef = useRef(false);

  useEffect(() => {
    // Only run once per session, and only for admin / encoder roles
    // (employees see their own card; school-admins don't need leave badges).
    if (preloadedRef.current) return;
    if (!state.isAdmin && !state.isEncoder) return;
    if (state.db.length === 0) return;   // db not ready yet — will retry below

    preloadedRef.current = true;

    const preloadAll = async () => {
      for (const e of state.db) {
        // Skip employees whose records are already loaded
        if (e.records && e.records.length > 0) continue;
        try {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok && res.records) {
            dispatch({
              type: 'SET_EMPLOYEE_RECORDS',
              payload: { id: e.id, records: res.records },
            });
          }
        } catch {
          // Silent — badge will just stay "pending" for this employee
        }
      }
    };

    preloadAll();
  // Re-run if db populates after the first render (e.g. session restore
  // fetches personnel list asynchronously).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.db.length, state.isAdmin, state.isEncoder]);

  function handleNavigate(page: string) {
    dispatch({ type: 'SET_PAGE', payload: page as never });
    try {
      const raw = sessionStorage.getItem('deped_session');
      if (raw) {
        const s = JSON.parse(raw);
        sessionStorage.setItem('deped_session', JSON.stringify({ ...s, page }));
      }
    } catch { /* ignore */ }
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    sessionStorage.removeItem('deped_session');
    // Allow re-preload on next login
    preloadedRef.current = false;
  }

  async function handleOpenCard(id: string) {
    const emp = state.db.find(e => e.id === id) as Personnel | undefined;
    const page = emp?.status === 'Teaching' ? 't' : 'nt';
    try {
      const raw = sessionStorage.getItem('deped_session');
      if (raw) {
        const s = JSON.parse(raw);
        sessionStorage.setItem('deped_session', JSON.stringify({ ...s, curId: id, page }));
      }
    } catch { /* ignore */ }

    dispatch({ type: 'SET_CUR_ID', payload: id });

    if (!emp?.records || emp.records.length === 0) {
      try {
        const res = await apiCall('get_records', { employee_id: id }, 'GET');
        if (res.ok && res.records) {
          dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id, records: res.records } });
        }
      } catch { /* navigate anyway */ }
    }

    dispatch({ type: 'SET_PAGE', payload: page });
  }

  function renderPage() {
    const p = state.page;
    if (isEmployee) return <UserPage onLogout={handleLogout} />;
    if (state.isSchoolAdmin) {
      if (p === 'sa') return <SchoolAdminPage />;
      return <HomepagePage showLeaveStats={false} />;
    }
    if (state.isAdmin || state.isEncoder) {
      if (p === 'list')  return <PersonnelListPage onOpenCard={handleOpenCard} />;
      if (p === 'cards') return <LeaveCardsPage onOpenCard={handleOpenCard} />;
      if (p === 'nt')    return <NTCardPage onBack={() => handleNavigate('cards')} />;
      if (p === 't')     return <TCardPage onBack={() => handleNavigate('cards')} />;
      return <HomepagePage showLeaveStats={true} />;
    }
    return null;
  }

  return (
    <div id="s-app" className="screen active">
      {!isEmployee && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNavigate={handleNavigate}
          currentPage={state.page}
        />
      )}
      <Topbar
        onMenuClick={() => setSidebarOpen(true)}
        showMenu={!isEmployee}
        onLogout={handleLogout}
        showLogoutBtn={isEmployee}
        showSettings={state.isAdmin && !state.isEncoder}
        onSettingsClick={() => setShowAccounts(true)}
      />
      <div className="ca">
        {renderPage()}
      </div>
      {showAccounts && <AdminProfileModal onClose={() => setShowAccounts(false)} />}
      <div id="printPageHeader" />
      <div id="pdfArea" />
    </div>
  );
}
