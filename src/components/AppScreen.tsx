'use client';
import { useState } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { Topbar, Sidebar } from '@/components/Navigation';
import PersonnelListPage from '@/components/pages/PersonnelListPage';
import LeaveCardsPage from '@/components/pages/LeaveCardsPage';
import SchoolAdminPage from '@/components/pages/SchoolAdminPage';
import UserPage from '@/components/pages/UserPage';
import NTCardPage from '@/components/pages/NTCardPage';
import TCardPage from '@/components/pages/TCardPage';

export default function AppScreen() {
  const { state, dispatch } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isEmployee = state.role === 'employee';

  function saveSession(updates: Record<string, unknown>) {
    try {
      const raw = sessionStorage.getItem('deped_session');
      const s = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem('deped_session', JSON.stringify({ ...s, ...updates }));
    } catch { /* ignore */ }
  }

  function handleNavigate(page: string) {
    dispatch({ type: 'SET_PAGE', payload: page as never });
    saveSession({ page });
  }

  function handleOpenCard(id: string) {
    dispatch({ type: 'SET_CUR_ID', payload: id });
    saveSession({ curId: id });
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    sessionStorage.removeItem('deped_session');
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
      />

      <div className="ca">
        {(state.isAdmin || state.isEncoder) && (
          <>
            <div className={`page${state.page === 'list'  ? ' on' : ''}`}>
              <PersonnelListPage onOpenCard={id => { handleOpenCard(id); }} />
            </div>
            <div className={`page${state.page === 'cards' ? ' on' : ''}`}>
              <LeaveCardsPage onOpenCard={id => {
                handleOpenCard(id);
                const emp = state.db.find(e => e.id === id);
                const page = emp?.status === 'Teaching' ? 't' : 'nt';
                handleNavigate(page);
              }} />
            </div>
            <div className={`page${state.page === 'nt'    ? ' on' : ''}`}>
              <NTCardPage onBack={() => handleNavigate('cards')} />
            </div>
            <div className={`page${state.page === 't'     ? ' on' : ''}`}>
              <TCardPage onBack={() => handleNavigate('cards')} />
            </div>
          </>
        )}

        {state.isSchoolAdmin && (
          <div className={`page${state.page === 'sa' ? ' on' : ''}`}>
            <SchoolAdminPage />
          </div>
        )}

        {isEmployee && (
          <div className={`page${state.page === 'user' ? ' on' : ''}`}>
            <UserPage onLogout={handleLogout} />
          </div>
        )}
      </div>

      <div id="printPageHeader" />
      <div id="pdfArea" />
    </div>
  );
}
