'use client';
import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';
import { apiCall, getNTAccrualKey, getMandatoryLeaveKey, computeRowBalanceUpdates, sortRecordsByDate } from '@/lib/api';
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
        background: 'var(--cd, #fff)', borderRadius: 14, padding: '32px 28px 24px',
        maxWidth: 420, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--cha, #111)', marginBottom: 12 }}>
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--mu, #555)', lineHeight: 1.65, marginBottom: 24, whiteSpace: 'pre-line' }}>
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
              padding: '9px 20px', borderRadius: 8, border: 'none',
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

// ── Main Page ────────────────────────────────────────────────
export default function LeaveCardsPage({ onOpenCard }: Props) {
  const { state, dispatch } = useAppStore();
  const [search, setSearch]                 = useState('');
  const [accrualPosting, setAccrualPosting] = useState(false);
  const [accrualMsg, setAccrualMsg]         = useState('');
  const [mandatoryPosting, setMandatoryPosting] = useState(false);
  const [mandatoryMsg, setMandatoryMsg]         = useState('');

  // Modal state
  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', confirmColor: '#1a5c42', onConfirm: () => {} });

  const closeModal = useCallback(() => setModal(m => ({ ...m, open: false })), []);

  const monthLabel    = currentMonthLabel();
  const accrualKey    = getNTAccrualKey();
  const mandatoryKey  = getMandatoryLeaveKey();
  const currentYear   = new Date().getFullYear();
  const currentMonth  = new Date().getMonth(); // 0-indexed; 11 = December
  const isDecember    = currentMonth === 11;

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

  const all    = useMemo(() => state.db, [state.db]);
  const q      = search.toLowerCase();
  const sorted = useMemo(() => {
    const matches = q
      ? all.filter(e => `${e.id || ''} ${e.surname || ''} ${e.given || ''} ${e.pos || ''}`.toLowerCase().includes(q))
      : all;
    return [...matches].sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));
  }, [all, q]);

  // ── Accrual logic (unchanged, but now called after modal confirm) ──
  async function runMonthlyNTAccrual() {
    const eligibleEmps = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    });

    if (eligibleEmps.length === 0) {
      alert('No active Non-Teaching or Teaching-Related employees found.');
      return;
    }

    setAccrualPosting(true);
    const now      = new Date();
    const todayISO = now.toISOString().split('T')[0];
    let successCount = 0;
    const errors: string[] = [];

    for (const e of eligibleEmps) {
      try {
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) {
            records = res.records || [];
            dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: e.id, records } });
          }
        }

        const accrual: LeaveRecord = {
          so: '', prd: monthLabel, from: todayISO, to: todayISO,
          spec: '', action: 'Monthly Accrual', earned: 1.25,
          forceAmount: 0, monV: 0, monS: 0, monDV: 0, monDS: 0,
          monAmount: 0, monDisAmt: 0, trV: 0, trS: 0,
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
      } catch (err) {
        errors.push(`${e.surname || e.id}: ${(err as Error).message || 'error'}`);
      }
    }

    localStorage.setItem(accrualKey, JSON.stringify({
      count: successCount,
      date:  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }));
    setAccrualPosting(false);

    if (errors.length > 0) {
      alert(`✅ Accrual posted for ${successCount} employee(s).\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n…and more' : ''}`);
    } else {
      alert(`✅ Monthly accrual successfully posted!\n\n• ${successCount} Non-Teaching / Teaching-Related employee(s) received 1.25 (Set A) + 1.25 (Set B)\n• Month: ${monthLabel}`);
    }
    setAccrualMsg(`✅ Posted for ${monthLabel}`);
  }

  function doMonthlyNTAccrual() {
    if (accrualDone) {
      alert(`⚠️ Monthly NT accrual has already been posted for ${monthLabel}.\n\nYou can only post once per month.`);
      return;
    }
    const eligibleCount = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    }).length;

    setModal({
      open: true,
      title: '📈 Post Monthly NT/TR Accrual',
      message:
        `This will add 1.25 (Set A) + 1.25 (Set B) leave credits to all ${eligibleCount} active Non-Teaching / Teaching-Related employee(s).\n\n` +
        `Month: ${monthLabel}\n\n` +
        `⚠️ This action can only be done ONCE this month.`,
      confirmLabel: 'Post Accrual',
      confirmColor: '#1a5c42',
      onConfirm: () => { closeModal(); runMonthlyNTAccrual(); },
    });
  }

  // ── Mandatory Leave deduction (5 days VL, December only, once per year) ──
  async function runMandatoryLeaveDeduction() {
    const eligibleEmps = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    });

    if (eligibleEmps.length === 0) {
      alert('No active Non-Teaching or Teaching-Related employees found.');
      return;
    }

    setMandatoryPosting(true);
    const now      = new Date();
    const todayISO = now.toISOString().split('T')[0];
    let successCount = 0;
    const errors: string[] = [];

    for (const e of eligibleEmps) {
      try {
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) {
            records = res.records || [];
            dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: e.id, records } });
          }
        }

        const deduction: LeaveRecord = {
          so: '', prd: `December ${currentYear}`, from: todayISO, to: todayISO,
          spec: '', action: 'Mandatory Leave',
          earned: 0, forceAmount: 5,
          monV: 0, monS: 0, monDV: 0, monDS: 0,
          monAmount: 0, monDisAmt: 0, trV: 0, trS: 0,
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
      } catch (err) {
        errors.push(`${e.surname || e.id}: ${(err as Error).message || 'error'}`);
      }
    }

    localStorage.setItem(mandatoryKey, JSON.stringify({
      count: successCount,
      date:  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }));
    setMandatoryPosting(false);

    if (errors.length > 0) {
      alert(`✅ Mandatory leave posted for ${successCount} employee(s).\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n…and more' : ''}`);
    } else {
      alert(`✅ Mandatory Leave deduction successfully posted!\n\n• ${successCount} employee(s) deducted 5 days from Vacation Leave\n• Year: ${currentYear}`);
    }
    setMandatoryMsg(`✅ Posted for ${currentYear}`);
  }

  function doMandatoryLeave() {
    if (!isDecember) return; // button is disabled anyway, but guard here too
    if (mandatoryDone) {
      alert(`⚠️ Mandatory Leave deduction has already been posted for ${currentYear}.\n\nThis can only be done once per year.`);
      return;
    }
    const eligibleCount = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    }).length;

    setModal({
      open: true,
      title: '📅 Post Mandatory Leave Deduction',
      message:
        `This will deduct 5 days from the Vacation Leave (Set A) balance of all ${eligibleCount} active Non-Teaching / Teaching-Related employee(s).\n\n` +
        `Year: ${currentYear}\n\n` +
        `⚠️ This action can only be done ONCE per year.`,
      confirmLabel: 'Post Deduction',
      confirmColor: '#9b1c1c',
      onConfirm: () => { closeModal(); runMandatoryLeaveDeduction(); },
    });
  }

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
        <div className="toolbar no-print" style={{ flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--mu)', fontWeight: 500 }}>
            Click an employee to open their leave card.
          </span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* ── Monthly NT Accrual Button ── */}
            <button
              id="ntAccrualBtn"
              className="btn"
              style={{
                background: 'linear-gradient(135deg,#1a5c42,#2e7d52)',
                color: 'white', fontWeight: 700, fontSize: 12,
                height: 36, padding: '0 18px', borderRadius: 8,
                opacity: accrualDone ? 0.5 : 1,
                cursor: accrualDone ? 'not-allowed' : 'pointer',
              }}
              onClick={doMonthlyNTAccrual}
              disabled={accrualPosting || accrualDone}
            >
              {accrualPosting ? '⏳ Posting…' : '📈 Post Monthly NT/TR Accrual (1.25 each)'}
            </button>
            <span style={{ fontSize: 11, color: accrualDone ? '#065f46' : 'var(--mu)' }}>
              {accrualDone && accrualInfo
                ? `✅ Already posted for ${monthLabel} — ${accrualInfo.count} employee(s) on ${accrualInfo.date}`
                : accrualMsg || `Not yet posted for ${monthLabel}`}
            </span>

            {/* ── Mandatory Leave Button (December only) ── */}
            <button
              id="mandatoryLeaveBtn"
              className="btn"
              title={!isDecember ? 'Available in December only' : mandatoryDone ? `Already posted for ${currentYear}` : `Post mandatory 5-day VL deduction for ${currentYear}`}
              style={{
                background: 'linear-gradient(135deg,#7f1d1d,#b91c1c)',
                color: 'white', fontWeight: 700, fontSize: 12,
                height: 36, padding: '0 18px', borderRadius: 8,
                opacity: (!isDecember || mandatoryDone) ? 0.45 : 1,
                cursor: (!isDecember || mandatoryDone) ? 'not-allowed' : 'pointer',
              }}
              onClick={doMandatoryLeave}
              disabled={mandatoryPosting || mandatoryDone || !isDecember}
            >
              {mandatoryPosting ? '⏳ Posting…' : '📅 Post Mandatory Leave (−5 VL)'}
            </button>
            <span style={{ fontSize: 11, color: mandatoryDone ? '#9b1c1c' : 'var(--mu)' }}>
              {mandatoryDone && mandatoryInfo
                ? `✅ Already posted for ${currentYear} — ${mandatoryInfo.count} employee(s) on ${mandatoryInfo.date}`
                : !isDecember
                  ? `🔒 Available in December only`
                  : mandatoryMsg || `Not yet posted for ${currentYear}`}
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
        </div>

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
                      color:      isT ? 'var(--nb)' : 'var(--g1)',
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
                        color:      upd ? '#065f46' : '#9b1c1c',
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
