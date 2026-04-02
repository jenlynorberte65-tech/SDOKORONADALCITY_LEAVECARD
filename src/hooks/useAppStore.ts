'use client';
// ============================================================
//  hooks/useAppStore.ts — Global application state (React context)
// ============================================================

import { createContext, useContext, useReducer, useCallback, Dispatch } from 'react';
import type { Personnel, AdminConfig, SchoolAdminConfig, Page, UserRole } from '@/types';

// ── State shape ───────────────────────────────────────────────
export interface AppState {
  db: Personnel[];
  isAdmin: boolean;
  isEncoder: boolean;
  isSchoolAdmin: boolean;
  role: UserRole | null;
  curId: string | null;
  page: Page;
  adminCfg: AdminConfig;
  encoderCfg: AdminConfig;
  schoolAdminCfg: SchoolAdminConfig;
  loading: boolean;
}

// ── Actions ───────────────────────────────────────────────────
export type AppAction =
  | { type: 'SET_DB'; payload: Personnel[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_ADMIN'; payload: { name: string; loginId: string; isEncoder: boolean } }
  | { type: 'LOGIN_SCHOOL_ADMIN'; payload: { name: string; loginId: string; dbId: number } }
  | { type: 'LOGIN_EMPLOYEE'; payload: { curId: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_PAGE'; payload: Page }
  | { type: 'SET_CUR_ID'; payload: string | null }
  | { type: 'UPDATE_EMPLOYEE'; payload: Personnel }
  | { type: 'ADD_EMPLOYEE'; payload: Personnel }
  | { type: 'SET_EMPLOYEE_RECORDS'; payload: { id: string; records: Personnel['records'] } }
  | { type: 'SET_ADMIN_CFG'; payload: { admin?: Partial<AdminConfig>; encoder?: Partial<AdminConfig> } }
  | { type: 'SET_SCHOOL_ADMIN_NAME'; payload: string };

// ── Initial state ─────────────────────────────────────────────
export const initialState: AppState = {
  db: [],
  isAdmin: false,
  isEncoder: false,
  isSchoolAdmin: false,
  role: null,
  curId: null,
  page: 'list',
  adminCfg:       { id: '', password: '', name: 'Administrator' },
  encoderCfg:     { id: '', password: '', name: 'Encoder' },
  schoolAdminCfg: { id: '', dbId: 0,    name: 'School Admin' },
  loading: false,
};

// ── Reducer ───────────────────────────────────────────────────
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DB':
      return { ...state, db: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'LOGIN_ADMIN':
      return {
        ...state,
        isAdmin: true,
        isEncoder: action.payload.isEncoder,
        isSchoolAdmin: false,
        role: action.payload.isEncoder ? 'encoder' : 'admin',
        adminCfg: action.payload.isEncoder ? state.adminCfg : { ...state.adminCfg, id: action.payload.loginId, name: action.payload.name },
        encoderCfg: action.payload.isEncoder ? { ...state.encoderCfg, id: action.payload.loginId, name: action.payload.name } : state.encoderCfg,
      };

    case 'LOGIN_SCHOOL_ADMIN':
      return {
        ...state,
        isSchoolAdmin: true,
        isAdmin: false,
        isEncoder: false,
        role: 'school_admin',
        schoolAdminCfg: { id: action.payload.loginId, dbId: action.payload.dbId, name: action.payload.name },
        page: 'sa',
      };

    case 'LOGIN_EMPLOYEE':
      return { ...state, isAdmin: false, isEncoder: false, isSchoolAdmin: false, role: 'employee', curId: action.payload.curId, page: 'user' };

    case 'LOGOUT':
      return { ...initialState };

    case 'SET_PAGE':
      return { ...state, page: action.payload };

    case 'SET_CUR_ID':
      return { ...state, curId: action.payload };

    case 'UPDATE_EMPLOYEE': {
      const idx = state.db.findIndex(e => e.id === action.payload.id);
      if (idx === -1) return state;
      const db = [...state.db];
      db[idx] = action.payload;
      return { ...state, db };
    }

    case 'ADD_EMPLOYEE':
      return { ...state, db: [...state.db, action.payload] };

    case 'SET_EMPLOYEE_RECORDS': {
      const idx = state.db.findIndex(e => e.id === action.payload.id);
      if (idx === -1) return state;
      const db = [...state.db];
      db[idx] = { ...db[idx], records: action.payload.records };
      return { ...state, db };
    }

    case 'SET_ADMIN_CFG':
      return {
        ...state,
        adminCfg:   { ...state.adminCfg,   ...(action.payload.admin   ?? {}) },
        encoderCfg: { ...state.encoderCfg, ...(action.payload.encoder ?? {}) },
      };

    case 'SET_SCHOOL_ADMIN_NAME':
      return { ...state, schoolAdminCfg: { ...state.schoolAdminCfg, name: action.payload } };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────
export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
} | null>(null);

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
