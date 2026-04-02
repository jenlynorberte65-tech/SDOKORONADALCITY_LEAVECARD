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

  return (
    <div id="s-app" className="screen active">
      {/* Sidebar — hidden for employee */}
      {!isEmployee && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNavigate={handleNavigate}
          currentPage={state.page}
        />
      )}

      {/* Topbar */}
      <Topbar
        onMenuClick={() => setSidebarOpen(true)}
        showMenu={!isEmployee}
        onLogout={handleLogout}
        showLogoutBtn={isEmployee}
      />

      {/* Page content */}
      <div className="ca">
        {/* Admin/Encoder pages */}
        {(state.isAdmin || state.isEncoder) && (
          <>
            <div className={`page${state.page === 'list'  ? ' on' : ''}`}>
              <PersonnelListPage onOpenCard={id => { dispatch({ type: 'SET_CUR_ID', payload: id }); }} />
            </div>
            <div className={`page${state.page === 'cards' ? ' on' : ''}`}>
              <LeaveCardsPage />
            </div>
            <div className={`page${state.page === 'nt'    ? ' on' : ''}`}>
              <NTCardPage onBack={() => handleNavigate('cards')} />
            </div>
            <div className={`page${state.page === 't'     ? ' on' : ''}`}>
              <TCardPage onBack={() => handleNavigate('cards')} />
            </div>
          </>
        )}

        {/* School Admin page */}
        {state.isSchoolAdmin && (
          <div className={`page${state.page === 'sa' ? ' on' : ''}`}>
            <SchoolAdminPage />
          </div>
        )}

        {/* Employee read-only view */}
        {isEmployee && (
          <div className={`page${state.page === 'user' ? ' on' : ''}`}>
            <UserPage onLogout={handleLogout} />
          </div>
        )}
      </div>

      {/* Hidden print/PDF areas */}
      <div id="printPageHeader" />
      <div id="pdfArea" />
    </div>
  );
}
