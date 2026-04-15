'use client';
import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';
import {
  apiCall, getNTAccrualKey, getMandatoryLeaveKey,
  computeRowBalanceUpdates, sortRecordsByDate, classifyLeave, getRecordYear,
} from '@/lib/api';
import type { LeaveRecord } from '@/types';

interface Props { onOpenCard?: (id: string) => void; }

// ── Confirmation Modal ────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmModal({ open, title, message, confirmLabel, confirmColor = '#1a5c42', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--cd, #fff)', borderRadius: 14, padding: '28px 28px 22px',
        maxWidth: 440, width: '92%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--cha, #111)', marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--mu, #555)', lineHeight: 1.7, marginBottom: 22, whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px', borderRadius: 8, border: '1.5px solid var(--br, #ddd)',
              background: 'transparent', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', color: 'var(--mu, #555)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 22px', borderRadius: 8, border: 'none',
              background: confirmColor, color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────
function StatusPill({ done, doneLabel, pendingLabel }: { done: boolean; doneLabel: string; pendingLabel: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: done ? '#d1fae5' : '#f3f4f6',
      color: done ? '#065f46' : 'var(--mu)',
      border: `1px solid ${done ? '#a7f3d0' : 'var(--br)'}`,
      whiteSpace: 'nowrap',
    }}>
      {done ? `✅ ${doneLabel}` : `⏳ ${pendingLabel}`}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function LeaveCardsPage({ onOpenCard }: Props) {
  const { state, dispatch } = useAppStore();
  const [search, setSearch]                     = useState('');
  const [accrualPosting, setAccrualPosting]     = useState(false);
  const [mandatoryPosting, setMandatoryPosting] = useState(false);
  const [accrualMsg, setAccrualMsg]             = useState('');
  const [mandatoryMsg, setMandatoryMsg]         = useState('');

  const [modal, setModal] = useState<{
    open: boolean; title: string; message: string;
    confirmLabel: string; confirmColor: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', confirmColor: '#1a5c42', onConfirm: () => {} });

  const closeModal = useCallback(() => setModal(m => ({ ...m, open: false })), []);

  const monthLabel   = currentMonthLabel();
  const accrualKey   = getNTAccrualKey();
  const mandatoryKey = getMandatoryLeaveKey();
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed; 11 = December
  const isDecember   = true; // TEMP: remove for testing, change back to: currentMonth === 11

  // ── LocalStorage state ────────────────────────────────────
  const accrualDone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(accrualKey);
  }, [accrualKey]);

  const accrualInfo = useMemo(() => {
    if (typeof window === 'undefined' || !accrualDone) return null;
    try { return JSON.parse(localStorage.getItem(accrualKey) || 'null'); } catch { return null; }
  }, [accrualDone, accrualKey]);

  const mandatoryDone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(mandatoryKey);
  }, [mandatoryKey]);

  const mandatoryInfo = useMemo(() => {
    if (typeof window === 'undefined' || !mandatoryDone) return null;
    try { return JSON.parse(localStorage.getItem(mandatoryKey) || 'null'); } catch { return null; }
  }, [mandatoryDone, mandatoryKey]);

  // ── Employee list ─────────────────────────────────────────
  const all    = useMemo(() => state.db, [state.db]);
  const q      = search.toLowerCase();
  const sorted = useMemo(() => {
    const matches = q
      ? all.filter(e => `${e.id || ''} ${e.surname || ''} ${e.given || ''} ${e.pos || ''}`.toLowerCase().includes(q))
      : all;
    return [...matches].sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));
  }, [all, q]);

  // ── NT Accrual (NT + Teaching Related only) ───────────────
  async function runMonthlyNTAccrual() {
    const eligibleEmps = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    });
    if (eligibleEmps.length === 0) { alert('No active Non-Teaching or Teaching-Related employees found.'); return; }

    setAccrualPosting(true);
    const todayISO = new Date().toISOString().split('T')[0];
    let successCount = 0;
    const errors: string[] = [];

    for (const e of eligibleEmps) {
      try {
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) { records = res.records || []; dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: e.id, records } }); }
        }
        const accrual: LeaveRecord = {
          so: '', prd: monthLabel, from: todayISO, to: todayISO,
          spec: '', action: 'Monthly Accrual', earned: 1.25,
          forceAmount: 0, monV: 0, monS: 0, monDV: 0, monDS: 0, monAmount: 0, monDisAmt: 0, trV: 0, trS: 0,
        };
        const saveRes = await apiCall('save_record', { employee_id: e.id, record: accrual });
        if (!saveRes.ok) { errors.push(`${e.surname}, ${e.given}: ${saveRes.error || 'failed'}`); continue; }
        accrual._record_id = saveRes.record_id;
        const newRecords = [...(records || []), accrual];
        sortRecordsByDate(newRecords);
        dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: e.id, records: newRecords } });
        dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...e, records: newRecords } });
        const empStatus = (e.status ?? '').toLowerCase() === 'teaching' ? 'Teaching' : 'Non-Teaching';
        const updates = computeRowBalanceUpdates(newRecords, e.id, empStatus);
        for (const u of updates) await apiCall('save_row_balance', u);
        successCount++;
      } catch (err) { errors.push(`${e.surname || e.id}: ${(err as Error).message || 'error'}`); }
    }

    localStorage.setItem(accrualKey, JSON.stringify({
      count: successCount,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }));
    setAccrualPosting(false);
    setAccrualMsg(`✅ Posted for ${monthLabel}`);
    if (errors.length > 0) {
      alert(`✅ Accrual posted for ${successCount} employee(s).\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n…and more' : ''}`);
    } else {
      alert(`✅ Monthly accrual successfully posted!\n\n• ${successCount} NT/TR employee(s) received 1.25 (Set A) + 1.25 (Set B)\n• Month: ${monthLabel}`);
    }
  }

  function doMonthlyNTAccrual() {
    if (accrualDone) { alert(`⚠️ Already posted for ${monthLabel}. Can only post once per month.`); return; }
    const count = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    }).length;
    setModal({
      open: true,
      title: '📈 Post Monthly NT/TR Accrual',
      message:
        `This will add 1.25 Set A + 1.25 Set B to all ${count} active Non-Teaching / Teaching-Related employee(s).\n\n` +
        `Month: ${monthLabel}\n\n` +
        `⚠️ This action can only be done ONCE this month.`,
      confirmLabel: 'Post Accrual',
      confirmColor: '#1a5c42',
      onConfirm: () => { closeModal(); runMonthlyNTAccrual(); },
    });
  }

  // ── Mandatory Leave (ALL active employees, skip if force leave already exists) ──
  async function runMandatoryLeaveDeduction() {
    // ALL active employees regardless of category
    const allActive = state.db.filter(e => e.account_status !== 'inactive');
    if (allActive.length === 0) { alert('No active employees found.'); return; }

    setMandatoryPosting(true);
    const todayISO = new Date().toISOString().split('T')[0];
    let successCount = 0;
    let skippedCount = 0;
    const skippedNames: string[] = [];
    const errors: string[] = [];

    for (const e of allActive) {
      try {
        // Fetch records if not loaded
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) { records = res.records || []; dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: e.id, records } }); }
        }

        // ── Skip if employee already has Force/Mandatory Leave for this year ──
        const hasForceLeaveThisYear = (records || []).some(r => {
          if (r._conversion) return false;
          const C = classifyLeave(r.action || '');
          return C.isForce && getRecordYear(r) === currentYear;
        });

        if (hasForceLeaveThisYear) {
          skippedCount++;
          skippedNames.push(`${e.surname}, ${e.given}`);
          continue;
        }

        const deduction: LeaveRecord = {
          so: '', prd: `December ${currentYear}`, from: todayISO, to: todayISO,
          spec: '', action: 'Mandatory Leave',
          earned: 0, forceAmount: 5,
          monV: 0, monS: 0, monDV: 0, monDS: 0, monAmount: 0, monDisAmt: 0, trV: 0, trS: 0,
        };

        const saveRes = await apiCall('save_record', { employee_id: e.id, record: deduction });
        if (!saveRes.ok) { errors.push(`${e.surname}, ${e.given}: ${saveRes.error || 'failed'}`); continue; }

        deduction._record_id = saveRes.record_id;
        const newRecords = [...(records || []), deduction];
        sortRecordsByDate(newRecords);
        dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: e.id, records: newRecords } });
        dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...e, records: newRecords } });

        const empStatus = (e.status ?? '').toLowerCase() === 'teaching' ? 'Teaching' : 'Non-Teaching';
        const updates = computeRowBalanceUpdates(newRecords, e.id, empStatus);
        for (const u of updates) await apiCall('save_row_balance', u);
        successCount++;
      } catch (err) { errors.push(`${e.surname || e.id}: ${(err as Error).message || 'error'}`); }
    }

    localStorage.setItem(mandatoryKey, JSON.stringify({
      count: successCount,
      skipped: skippedCount,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }));
    setMandatoryPosting(false);
    setMandatoryMsg(`✅ Posted for ${currentYear}`);

    let msg = `✅ Mandatory Leave deduction posted!\n\n• ${successCount} employee(s) deducted 5 days VL\n• Year: ${currentYear}`;
    if (skippedCount > 0) {
      msg += `\n\n⏭ Skipped ${skippedCount} employee(s) — already have Force/Mandatory Leave for ${currentYear}:`;
      msg += '\n' + skippedNames.slice(0, 8).join('\n');
      if (skippedNames.length > 8) msg += `\n…and ${skippedNames.length - 8} more`;
    }
    if (errors.length > 0) {
      msg += `\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}`;
    }
    alert(msg);
  }

  function doMandatoryLeave() {
    if (!isDecember) return;
    if (mandatoryDone) { alert(`⚠️ Mandatory Leave already posted for ${currentYear}. This can only be done once per year.`); return; }

    const allActive = state.db.filter(e => e.account_status !== 'inactive');

    // Pre-compute how many will be skipped (based on already-loaded records)
    const alreadyHaveForce = allActive.filter(e =>
      (e.records || []).some(r => {
        if (r._conversion) return false;
        const C = classifyLeave(r.action || '');
        return C.isForce && getRecordYear(r) === currentYear;
      })
    ).length;

    const willDeduct = allActive.length - alreadyHaveForce;

    setModal({
      open: true,
      title: '📅 Post Mandatory Leave Deduction',
      message:
        `This will deduct 5 days from the Vacation Leave of all eligible active employees.\n\n` +
        `• Total active employees: ${allActive.length}\n` +
        `• Will be deducted: ${willDeduct} employee(s)\n` +
        `• Skipped (already have force leave): ~${alreadyHaveForce} employee(s)\n\n` +
        `Year: ${currentYear}\n\n` +
        `⚠️ This action can only be done ONCE per year.\n` +
        `Employees with existing Force/Mandatory Leave for ${currentYear} will be automatically skipped.`,
      confirmLabel: 'Post Deduction',
      confirmColor: '#9b1c1c',
      onConfirm: () => { closeModal(); runMandatoryLeaveDeduction(); },
    });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <ConfirmModal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        confirmLabel={modal.confirmLabel}
        confirmColor={modal.confirmColor}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
      />

      <div className="card">
        <div className="ch grn">📋 Leave Cards</div>

        {/* ── Toolbar ── */}
        <div className="no-print" style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--dv)' }}>

          {/* Row 1: hint + search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--mu)', fontWeight: 500 }}>
              Click an employee to open their leave card.
            </span>
            <div className="srch">
              <span className="sri">🔍</span>
              <input
                type="text"
                placeholder="Search name or ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* NT Accrual block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <button
                id="ntAccrualBtn"
                className="btn"
                style={{
                  background: accrualDone
                    ? 'var(--g4)' : 'linear-gradient(135deg,#1a5c42,#2e7d52)',
                  color: accrualDone ? '#065f46' : 'white',
                  fontWeight: 700, fontSize: 12,
                  height: 36, padding: '0 16px', borderRadius: 8,
                  border: accrualDone ? '1.5px solid #a7f3d0' : 'none',
                  opacity: accrualDone ? 0.85 : 1,
                  cursor: accrualDone ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={doMonthlyNTAccrual}
                disabled={accrualPosting || accrualDone}
              >
                {accrualPosting ? '⏳ Posting…' : '📈 Post Monthly NT/TR Accrual (1.25 each)'}
              </button>
              <StatusPill
                done={accrualDone}
                doneLabel={accrualInfo ? `Posted for ${monthLabel} — ${accrualInfo.count} emp(s) on ${accrualInfo.date}` : `Posted for ${monthLabel}`}
                pendingLabel={accrualMsg || `Not yet posted for ${monthLabel}`}
              />
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: 'var(--br)', alignSelf: 'stretch', margin: '2px 4px' }} />

            {/* Mandatory Leave block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <button
                id="mandatoryLeaveBtn"
                className="btn"
                title={
                  !isDecember
                    ? 'Available in December only'
                    : mandatoryDone
                      ? `Already posted for ${currentYear}`
                      : `Post mandatory 5-day VL deduction for ${currentYear}`
                }
                style={{
                  background: (mandatoryDone || !isDecember)
                    ? '#fef2f2' : 'linear-gradient(135deg,#7f1d1d,#b91c1c)',
                  color: (mandatoryDone || !isDecember) ? '#9b1c1c' : 'white',
                  fontWeight: 700, fontSize: 12,
                  height: 36, padding: '0 16px', borderRadius: 8,
                  border: (mandatoryDone || !isDecember) ? '1.5px solid #fca5a5' : 'none',
                  opacity: (!isDecember || mandatoryDone) ? 0.7 : 1,
                  cursor: (!isDecember || mandatoryDone) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={doMandatoryLeave}
                disabled={mandatoryPosting || mandatoryDone || !isDecember}
              >
                {mandatoryPosting ? '⏳ Posting…' : '📅 Post Mandatory Leave (−5 VL)'}
              </button>
              <StatusPill
                done={mandatoryDone}
                doneLabel={
                  mandatoryInfo
                    ? `Posted for ${currentYear} — ${mandatoryInfo.count} emp(s)${mandatoryInfo.skipped ? `, ${mandatoryInfo.skipped} skipped` : ''} on ${mandatoryInfo.date}`
                    : `Posted for ${currentYear}`
                }
                pendingLabel={
                  !isDecember
                    ? `🔒 Available in December only`
                    : mandatoryMsg || `Not yet posted for ${currentYear}`
                }
              />
            </div>

          </div>
        </div>

        {/* ── Employee List ── */}
        <div id="cardsEmployeeList" style={{ padding: '12px 16px 8px' }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '16px 4px', color: 'var(--mu)', fontStyle: 'italic', fontSize: 13 }}>
              No employees found{q ? ` for "${search}"` : ''}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sorted.map(e => {
                const isInactive = e.account_status === 'inactive';
                const isT        = (e.status ?? '').toLowerCase() === 'teaching';
                const upd        = !isInactive && isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
                return (
                  <button
                    key={e.id}
                    onClick={() => onOpenCard?.(e.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', borderRadius: 8,
                      border: `1.5px solid ${isInactive ? '#e5e7eb' : 'var(--br)'}`,
                      background: isInactive ? '#f9fafb' : 'var(--cd)',
                      cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                      fontSize: 12, fontWeight: 500,
                      opacity: isInactive ? 0.65 : 1,
                      transition: 'all .15s',
                    }}
                  >
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                      background: isT ? '#ddeeff' : 'var(--g4)',
                      color: isT ? 'var(--nb)' : 'var(--g1)',
                    }}>
                      {e.status}
                    </span>
                    <span style={{ fontWeight: 700, color: isInactive ? '#6b7280' : 'var(--cha)' }}>
                      {(e.surname || '').toUpperCase()}, {e.given || ''} {e.suffix || ''}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--mu)', fontFamily: "'JetBrains Mono',monospace" }}>
                      {e.id}
                    </span>
                    {isInactive ? (
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 700, background: '#f3f4f6', color: '#6b7280' }}>
                        INACTIVE
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                        background: upd ? '#d1fae5' : '#fee2e2',
                        color: upd ? '#065f46' : '#9b1c1c',
                      }}>
                        {upd ? '✅' : '⏳'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
