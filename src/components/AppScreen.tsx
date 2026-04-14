'use client';
import { useState } from 'react';
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
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [showAccounts,  setShowAccounts]  = useState(false);

  const isEmployee = state.role === 'employee';

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

      {/* Account Management Modal — admin only, accessible from topbar */}
      {showAccounts && <AdminProfileModal onClose={() => setShowAccounts(false)} />}

      <div id="printPageHeader" />
      <div id="pdfArea" />
    </div>
  );
}
