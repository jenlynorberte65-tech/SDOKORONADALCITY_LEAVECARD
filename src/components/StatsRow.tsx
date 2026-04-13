'use client';
import type { LeaveRecord } from '@/types';

interface StatBoxProps {
  icon: string;
  iconClass?: string;
  iconStyle?: React.CSSProperties;
  value: number | string;
  label: string;
  onClick?: () => void;
  valueStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}
export function StatBox({ icon, iconClass, iconStyle, value, label, onClick, valueStyle, style }: StatBoxProps) {
  return (
    <div className="stat-box" style={{ ...(onClick ? { cursor: 'pointer' } : {}), ...style }} onClick={onClick}>
      <div className={`stat-icon${iconClass ? ' ' + iconClass : ''}`} style={iconStyle}>{icon}</div>
      <div>
        <div className="stat-val" style={valueStyle}>{value}</div>
        <div className="stat-lbl">{label}</div>
      </div>
    </div>
  );
}

export function currentMonthLabel(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Checks if last_edited_at falls within the current month/year.
 * This is the reliable way to track "updated this month" since
 * leave records are loaded on-demand and may be empty on refresh.
 */
export function isCardUpdatedThisMonth(
  records: LeaveRecord[],
  empStatus: string,
  lastEditedAt?: string | null
): boolean {
  const now      = new Date();
  const thisYear = now.getFullYear();
  const thisMon  = now.getMonth(); // 0-indexed

  // ── Primary check: use last_edited_at from personnel row ─────────────────
  // This persists across refreshes and is updated on every save.
  if (lastEditedAt) {
    const d = new Date(lastEditedAt);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() === thisYear && d.getMonth() === thisMon;
    }
  }

  // ── Fallback: check records if last_edited_at is not available ────────────
  if (!records || records.length === 0) return false;

  const category = empStatus?.toLowerCase() ?? '';

  if (category === 'teaching') {
    return records.some(r => !r._conversion);
  }

  // Non-Teaching and Teaching-Related: must have a 1.25 accrual for THIS month
  return records.some(r => {
    if (r._conversion) return false;
    const action = (r.action ?? '').toLowerCase();
    if (!action.includes('accrual') && !action.includes('service credit')) return false;

    const dateStr = r.from || r.to || r.prd || '';
    if (!dateStr) return false;

    let d: Date | null = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      d = new Date(dateStr + 'T00:00:00');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [mm, , yyyy] = dateStr.split('/');
      d = new Date(`${yyyy}-${mm}-01T00:00:00`);
    } else {
      const yearMatch  = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
      const monthNames = ['january','february','march','april','may','june',
                          'july','august','september','october','november','december'];
      const lower      = dateStr.toLowerCase();
      const monthIdx   = monthNames.findIndex(m => lower.includes(m));
      if (yearMatch && monthIdx !== -1) {
        d = new Date(parseInt(yearMatch[1]), monthIdx, 1);
      } else if (yearMatch) {
        return false;
      }
    }

    if (!d || isNaN(d.getTime())) return false;
    return d.getFullYear() === thisYear && d.getMonth() === thisMon;
  });
}

/**
 * @deprecated Use isCardUpdatedThisMonth(records, empStatus, lastEditedAt) directly.
 */
export function isUpdatedThisMonth(lastEditedAt: string | null | undefined): boolean {
  void lastEditedAt;
  return false;
}
