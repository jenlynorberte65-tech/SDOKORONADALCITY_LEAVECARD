'use client';

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

export function isUpdatedThisMonth(lastEditedAt: string | null | undefined): boolean {
  if (!lastEditedAt) return false;
  const now = new Date();
  const dt  = new Date(lastEditedAt);
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
}

export function currentMonthLabel(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
