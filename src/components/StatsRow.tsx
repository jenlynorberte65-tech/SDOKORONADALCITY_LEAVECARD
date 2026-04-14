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
export function StatBox({
  icon, iconClass, iconStyle, value, label, onClick, valueStyle, style,
}: StatBoxProps) {
  return (
    <div
      className="stat-box"
      style={{ ...(onClick ? { cursor: 'pointer' } : {}), ...style }}
      onClick={onClick}
    >
      <div className={`stat-icon${iconClass ? ' ' + iconClass : ''}`} style={iconStyle}>
        {icon}
      </div>
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

// ── Internal date parser ──────────────────────────────────────
// Parses ISO (YYYY-MM-DD), MM/DD/YYYY, or natural-language strings (e.g. "April 2025").
// Returns a Date anchored to the 1st of the parsed month, or null if unparseable.
function parseDateForCheck(dateStr: string): Date | null {
  if (!dateStr) return null;

  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }

  // MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [mm, , yyyy] = dateStr.split('/');
    return new Date(`${yyyy}-${mm.padStart(2, '0')}-01T00:00:00`);
  }

  // Natural language: extract year + month name (e.g. "April 2025", "January 2026")
  const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const lower    = dateStr.toLowerCase();
  const monthIdx = monthNames.findIndex(m => lower.includes(m));

  if (yearMatch && monthIdx !== -1) {
    return new Date(parseInt(yearMatch[1]), monthIdx, 1);
  }

  return null;
}

/**
 * isCardUpdatedThisMonth
 * ──────────────────────
 * Returns true only when a genuine, current-month entry exists in the
 * employee's records — never based on lastEditedAt, which is too broad
 * (it updates on ANY save: profile edits, past-record additions, new
 * employee registration) and would produce false "updated" badges.
 *
 * Teaching:
 *   → true  when records contains at least one non-conversion entry
 *            whose `from` or `to` date falls in the current month/year.
 *   → false for zero records (new employee) or no current-month entries.
 *
 * Non-Teaching / Teaching-Related:
 *   → true  when records contains a Monthly Accrual (or Service Credit)
 *            entry whose date falls in the current month/year.
 *   → false if accrual has not yet been posted for this month.
 *
 * The lastEditedAt parameter is kept for call-site compatibility but is
 * intentionally not used for status evaluation.
 */
export function isCardUpdatedThisMonth(
  records: LeaveRecord[],
  empStatus: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lastEditedAt?: string | null,   // retained for API compat — NOT used for logic
): boolean {
  const now      = new Date();
  const thisYear = now.getFullYear();
  const thisMon  = now.getMonth(); // 0-indexed

  // No records loaded yet → always "not yet updated"
  if (!records || records.length === 0) return false;

  const category = (empStatus ?? '').toLowerCase();

  // ── Teaching ────────────────────────────────────────────────────────────
  // A Teaching employee is "updated" when at least one leave entry (not a
  // conversion marker) has a from/to date that falls in the current month.
  // New employees (zero records) always fall through to false above.
  if (category === 'teaching') {
    return records.some(r => {
      if (r._conversion) return false;
      const dateStr = r.from || r.to || '';
      if (!dateStr) return false;
      const d = parseDateForCheck(dateStr);
      return !!d && d.getFullYear() === thisYear && d.getMonth() === thisMon;
    });
  }

  // ── Non-Teaching / Teaching-Related ─────────────────────────────────────
  // These employees are "updated" only when the monthly accrual (1.25 each)
  // has been posted for the current month. Any other edit — including profile
  // saves or adding leave entries — must NOT flip the badge to "updated".
  return records.some(r => {
    if (r._conversion) return false;

    const action = (r.action ?? '').toLowerCase();
    if (!action.includes('accrual') && !action.includes('service credit')) return false;

    // Match against from, to, or prd (period label) — whichever is set.
    const dateStr = r.from || r.to || r.prd || '';
    if (!dateStr) return false;

    const d = parseDateForCheck(dateStr);
    return !!d && d.getFullYear() === thisYear && d.getMonth() === thisMon;
  });
}

/**
 * @deprecated Use isCardUpdatedThisMonth(records, empStatus) directly.
 * lastEditedAt alone is not a reliable indicator of a current-month card update.
 */
export function isUpdatedThisMonth(lastEditedAt: string | null | undefined): boolean {
  void lastEditedAt;
  return false;
}
