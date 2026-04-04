// ============================================================
//  lib/recordToRow.ts — DB ↔ JS record conversion helpers
// ============================================================

import { normaliseDate } from './db';
import type { LeaveRecord } from '@/types';

// ── JS record → DB row ────────────────────────────────────────
export function recordToRow(r: LeaveRecord, empId: string, sortOrder: number): Record<string, unknown> {
  const isConv   = !!r._conversion;
  const action   = (r.action || '').toLowerCase();
  const isXfer   = action.includes('from denr');

  const setAEarned = r.setA_earned !== undefined ? r.setA_earned
                   : isXfer ? (r.trV || 0) : 0;
  const setBEarned = r.setB_earned !== undefined ? r.setB_earned
                   : isXfer ? (r.trS || 0) : 0;

  return {
    employee_id:     empId,
    sort_order:      sortOrder,
    so:              r.so    ?? '',
    prd:             isConv ? '' : (r.prd ?? ''),
    from_date:       normaliseDate(r.from ?? ''),
    to_date:         normaliseDate(r.to   ?? ''),
    spec:            r.spec   ?? '',
    action:          r.action ?? '',
    force_amount:    r.forceAmount ?? 0,
    setA_earned:     setAEarned,
    setA_abs_wp:     r.setA_abs_wp  ?? 0,
    setA_balance:    isConv ? (r.fwdBV ?? 0) : (r.setA_balance ?? 0),
    setA_wop:        r.setA_wop     ?? 0,
    setB_earned:     setBEarned,
    setB_abs_wp:     r.setB_abs_wp  ?? 0,
    setB_balance:    isConv ? (r.fwdBS ?? 0) : (r.setB_balance ?? 0),
    setB_wop:        r.setB_wop     ?? 0,
    is_conversion:   isConv ? 1 : 0,
    from_status:     r.fromStatus  ?? '',
    to_status:       r.toStatus    ?? '',
    conversion_date: normaliseDate(r.date ?? ''),
  };
}

// ── DB row → JS record ────────────────────────────────────────
export function rowToRecord(row: Record<string, unknown>): LeaveRecord {
  const action  = String(row.action ?? '').toLowerCase();
  const isMon   = action.includes('monetization') && !action.includes('disapproved');
  const isMD    = action.includes('monetization') &&  action.includes('disapproved');
  const isXfer  = action.includes('from denr');

  const setAE = Number(row.setA_earned ?? 0);
  const setBE = Number(row.setB_earned ?? 0);
  const setAA = Number(row.setA_abs_wp ?? 0);
  const setBA = Number(row.setB_abs_wp ?? 0);

  const r: LeaveRecord = {
    so:          String(row.so    ?? ''),
    prd:         String(row.prd   ?? ''),
    // REPLACE WITH:
    from:        row.from_date ? (row.from_date instanceof Date ? row.from_date.toISOString().slice(0,10) : String(row.from_date).slice(0,10)) : '',
    to:          row.to_date   ? (row.to_date   instanceof Date ? row.to_date.toISOString().slice(0,10)   : String(row.to_date).slice(0,10))   : '',
    spec:        String(row.spec  ?? ''),
    action:      String(row.action ?? ''),
    forceAmount: Number(row.force_amount ?? 0),
    earned:      setAE,
    monAmount:   isMon ? setAA : 0,
    monDisAmt:   isMD  ? setAA : 0,
    monV:        isMon ? setAA : 0,
    monS:        isMon ? setBA : 0,
    monDV:       isMD  ? setAA : 0,
    monDS:       isMD  ? setBA : 0,
    trV:         isXfer ? setAE : 0,
    trS:         isXfer ? setBE : 0,
    setA_earned:  setAE,
    setA_abs_wp:  setAA,
    setA_balance: Number(row.setA_balance ?? 0),
    setA_wop:     Number(row.setA_wop     ?? 0),
    setB_earned:  setBE,
    setB_abs_wp:  setBA,
    setB_balance: Number(row.setB_balance ?? 0),
    setB_wop:     Number(row.setB_wop     ?? 0),
    _record_id:   Number(row.record_id),
  };

  if (row.is_conversion) {
    r._conversion = true;
    r.fromStatus  = String(row.from_status     ?? '');
    r.toStatus    = String(row.to_status       ?? '');
    r.date        = String(row.conversion_date ?? '');
    r.fwdBV       = Number(row.setA_balance ?? 0);
    r.fwdBS       = Number(row.setB_balance ?? 0);
  }
  return r;
}

// ── Personnel DB row → JS object ─────────────────────────────
export function personnelRowToJs(r: Record<string, unknown>): Record<string, unknown> {
  return {
    id:             r.employee_id,
    email:          r.email,
    password:       r.password,
    surname:        r.surname,
    given:          r.given,
    suffix:         r.suffix,
    maternal:       r.maternal,
    sex:            r.sex,
    civil:          r.civil,
    dob:            r.dob,
    pob:            r.pob,
    addr:           r.addr,
    spouse:         r.spouse,
    edu:            r.edu,
    elig:           r.elig,
    rating:         r.rating,
    tin:            r.tin,
    pexam:          r.pexam,
    dexam:          r.dexam,
    appt:           r.appt,
    status:         r.status,
    account_status: r.account_status ?? 'active',
    pos:            r.pos,
    school:         r.school,
    lastEditedAt:   r.last_edited_at,
    conversionLog:  [],
    records:        [],
  };
}
