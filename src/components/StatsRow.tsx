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
 * Determines whether an employee's leave card is considered "updated" for the
 * current month, based solely on leave card records — NOT on last_edited_at.
 *
 * Rules:
 *  - Teaching:          updated if ANY leave record exists on the card.
 *  - Non-Teaching:      updated only if a 1.25 accrual record exists for the
 *                       current month/year.
 *  - Teaching-Related:  same as Non-Teaching (1.25 accrual required).
 */
export function isCardUpdatedThisMonth(
  records: LeaveRecord[],
  empStatus: string   // 'Teaching' | 'Non-Teaching' | 'Teaching Related'
): boolean {
  if (!records || records.length === 0) return false;

  const now      = new Date();
  const thisYear = now.getFullYear();
  const thisMon  = now.getMonth(); // 0-indexed

  const category = empStatus?.toLowerCase() ?? '';

  if (category === 'teaching') {
    // Any real (non-conversion) record means the card has data → updated
    return records.some(r => !r._conversion);
  }

  // Non-Teaching and Teaching-Related: must have a 1.25 accrual for THIS month
  return records.some(r => {
    if (r._conversion) return false;
    const action = (r.action ?? '').toLowerCase();
    if (!action.includes('accrual') && !action.includes('service credit')) return false;

    // Check the record's date falls in the current month/year.
    // Accrual records typically use `prd` (period) or `from` date.
    const dateStr = r.from || r.to || r.prd || '';
    if (!dateStr) return false;

    let d: Date | null = null;

    // ISO date: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      d = new Date(dateStr + 'T00:00:00');
    }
    // MM/DD/YYYY
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [mm, , yyyy] = dateStr.split('/');
      d = new Date(`${yyyy}-${mm}-01T00:00:00`);
    }
    // prd may contain "Month YYYY" text e.g. "April 2026"
    else {
      const yearMatch  = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
      const monthNames = ['january','february','march','april','may','june',
                          'july','august','september','october','november','december'];
      const lower      = dateStr.toLowerCase();
      const monthIdx   = monthNames.findIndex(m => lower.includes(m));
      if (yearMatch && monthIdx !== -1) {
        d = new Date(parseInt(yearMatch[1]), monthIdx, 1);
      } else if (yearMatch) {
        // year only — skip, not specific enough
        return false;
      }
    }

    if (!d || isNaN(d.getTime())) return false;
    return d.getFullYear() === thisYear && d.getMonth() === thisMon;
  });
}

/**
 * Legacy helper kept for any call-site that used to pass lastEditedAt.
 * Now delegates to isCardUpdatedThisMonth — pass records instead.
 * @deprecated Use isCardUpdatedThisMonth(records, empStatus) directly.
 */
export function isUpdatedThisMonth(lastEditedAt: string | null | undefined): boolean {
  // Can no longer determine update status from timestamp alone.
  // This stub returns false so old call-sites don't silently show wrong data.
  void lastEditedAt;
  return false;
}
