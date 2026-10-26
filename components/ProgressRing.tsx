/** Anneau de progression avec le compteur au centre. */
export function ProgressRing({ value, total, size = 56 }: { value: number; total: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(1, value / total) : 0;

  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.2, 0.9, 0.3, 1)" }}
        />
      </svg>
      <span key={value} className="animate-pop absolute text-sm font-black tabular-nums">
        {value}
        <span className="text-[10px] font-bold text-muted">/{total}</span>
      </span>
    </span>
  );
}
