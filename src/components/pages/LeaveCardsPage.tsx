'use client';
import { useState, useMemo } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';
import { apiCall, getNTAccrualKey, computeRowBalanceUpdates, sortRecordsByDate } from '@/lib/api';
import type { LeaveRecord } from '@/types';

interface Props { onOpenCard?: (id: string) => void; }

export default function LeaveCardsPage({ onOpenCard }: Props) {
  const { state, dispatch } = useAppStore();
  const [search, setSearch]                 = useState('');
  const [accrualPosting, setAccrualPosting] = useState(false);
  const [accrualMsg, setAccrualMsg]         = useState('');

  const monthLabel = currentMonthLabel();
  const accrualKey = getNTAccrualKey();

  const accrualDone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(accrualKey);
  }, [accrualKey]);

  const accrualInfo = useMemo(() => {
    if (typeof window === 'undefined' || !accrualDone) return null;
    try { return JSON.parse(localStorage.getItem(accrualKey) || 'null'); } catch { return null; }
  }, [accrualDone, accrualKey]);

  // All employees regardless of account_status — inactive are shown in the list
  const all    = useMemo(() => state.db, [state.db]);
  const q      = search.toLowerCase();
  const sorted = useMemo(() => {
    const matches = q
      ? all.filter(e => `${e.id || ''} ${e.surname || ''} ${e.given || ''} ${e.pos || ''}`.toLowerCase().includes(q))
      : all;
    return [...matches].sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));
  }, [all, q]);

  async function doMonthlyNTAccrual() {
    if (accrualDone) {
      alert(`⚠️ Monthly NT accrual has already been posted for ${monthLabel}.\n\nYou can only post once per month.`);
      return;
    }

    // Only ACTIVE Non-Teaching and Teaching-Related employees receive the accrual
    const eligibleEmps = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    });

    if (eligibleEmps.length === 0) {
      alert('No active Non-Teaching or Teaching-Related employees found.');
      return;
    }

    if (!confirm(
      `Post monthly accrual (1.25 Set A + 1.25 Set B) for ${monthLabel}?\n\n` +
      `This will add an entry to all ${eligibleEmps.length} active Non-Teaching / Teaching-Related employee(s).\n\n` +
      `This action can only be done ONCE this month.`
    )) return;

    setAccrualPosting(true);
    const now      = new Date();
    const todayISO = now.toISOString().split('T')[0];
    let successCount = 0;
    const errors: string[] = [];

    for (const e of eligibleEmps) {
      try {
        // Load records only if not already in state
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
        if (!saveRes.ok) {
          errors.push(`${e.surname}, ${e.given}: ${saveRes.error || 'failed'}`);
          continue;
        }

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
      alert(
        `✅ Accrual posted for ${successCount} employee(s).\n\n` +
        `⚠️ Errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}` +
        `${errors.length > 5 ? '\n…and more' : ''}`
      );
    } else {
      alert(
        `✅ Monthly accrual successfully posted!\n\n` +
        `• ${successCount} Non-Teaching / Teaching-Related employee(s) received 1.25 (Set A) + 1.25 (Set B)\n` +
        `• Month: ${monthLabel}`
      );
    }
    setAccrualMsg(`✅ Posted for ${monthLabel}`);
  }

  return (
    <div className="card">
      <div className="ch grn">📋 Leave Cards</div>
      <div className="toolbar no-print" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--mu)', fontWeight: 500 }}>
          Click an employee to open their leave card.
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
              // ✅ FIX: pass lastEditedAt so badge reflects DB value correctly
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
                  {/* Category badge */}
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                    background: isT ? '#ddeeff' : 'var(--g4)',
                    color:      isT ? 'var(--nb)' : 'var(--g1)',
                  }}>
                    {e.status}
                  </span>

                  {/* Name */}
                  <span style={{ fontWeight: 700, color: isInactive ? '#6b7280' : 'var(--cha)' }}>
                    {(e.surname || '').toUpperCase()}, {e.given || ''} {e.suffix || ''}
                  </span>

                  {/* ID */}
                  <span style={{ fontSize: 10, color: 'var(--mu)', fontFamily: "'JetBrains Mono',monospace" }}>
                    {e.id}
                  </span>

                  {/* Inactive badge OR updated/not-updated badge */}
                  {isInactive ? (
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 10,
                      fontWeight: 700, background: '#f3f4f6', color: '#6b7280',
                    }}>
                      INACTIVE
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 10,
                      fontWeight: 700,
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
  );
}
