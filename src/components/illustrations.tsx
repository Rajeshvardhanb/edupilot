/* Flat SVG illustrations. Colours come from the CSS tokens. */
type P = { className?: string };

const B = "var(--brand)", B2 = "var(--brand-2)", SOFT = "var(--brand-soft)", SURF = "var(--surface)", LINE = "var(--line)";

export function CampusIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 420 220" className={className} role="img" aria-label="College campus">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".18" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
      </defs>
      <circle cx="350" cy="48" r="22" fill="#fde68a" opacity=".9" />
      <g fill="#ffffff" opacity=".55">
        <ellipse cx="80" cy="44" rx="30" ry="9" /><ellipse cx="102" cy="38" rx="18" ry="10" />
        <ellipse cx="262" cy="30" rx="24" ry="7" /><ellipse cx="280" cy="25" rx="14" ry="8" />
      </g>
      <rect x="0" y="0" width="420" height="220" fill="url(#sky)" />
      {/* main block */}
      <rect x="120" y="88" width="180" height="104" rx="4" fill="#ffffff" opacity=".95" />
      <polygon points="110,92 210,48 310,92" fill="#ffffff" />
      <polygon points="134,88 210,56 286,88" fill="#c7d2fe" />
      <circle cx="210" cy="74" r="10" fill="#ffffff" stroke="#6366f1" strokeWidth="3" />
      <path d="M210 68v6l4 3" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" fill="none" />
      {[140, 166, 192, 218, 244, 270].map((x) => <rect key={x} x={x} y="100" width="10" height="70" rx="2" fill="#e0e7ff" />)}
      <rect x="196" y="150" width="28" height="42" rx="14" fill="#6366f1" />
      <rect x="112" y="186" width="196" height="8" rx="2" fill="#e0e7ff" />
      {/* wings */}
      <rect x="44" y="118" width="70" height="74" rx="4" fill="#ffffff" opacity=".85" />
      <rect x="306" y="110" width="76" height="82" rx="4" fill="#ffffff" opacity=".85" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`l${r}${c}`} x={54 + c * 20} y={128 + r * 20} width="12" height="12" rx="2" fill="#a5b4fc" />))}
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`r${r}${c}`} x={318 + c * 20} y={122 + r * 22} width="12" height="14" rx="2" fill="#a5b4fc" />))}
      {/* trees */}
      {[[24, 170], [398, 168], [96, 178]].map(([x, y]) => (
        <g key={x}><rect x={x - 2} y={y} width="4" height="22" fill="#92400e" opacity=".7" /><circle cx={x} cy={y - 4} r="14" fill="#34d399" /><circle cx={x + 7} cy={y + 2} r="9" fill="#10b981" /></g>
      ))}
      <rect x="0" y="192" width="420" height="28" fill="#ffffff" opacity=".25" />
      {/* students */}
      {[[160, "#f59e0b"], [178, "#ec4899"], [252, "#22d3ee"]].map(([x, c]) => (
        <g key={x as number} transform={`translate(${x} 196)`}><circle cx="0" cy="-14" r="4" fill="#fde2c8" /><rect x="-4" y="-10" width="8" height="12" rx="3" fill={c as string} /></g>
      ))}
    </svg>
  );
}

export function GraduationIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 200 160" className={className} role="img" aria-label="Graduation">
      <circle cx="100" cy="84" r="64" fill={SOFT} />
      <rect x="44" y="104" width="112" height="22" rx="11" fill={SURF} stroke={LINE} />
      <rect x="44" y="104" width="22" height="22" rx="11" fill={B2} opacity=".35" />
      <polygon points="100,34 164,62 100,90 36,62" fill={B} />
      <path d="M66 74v20c0 8 15 15 34 15s34-7 34-15V74l-34 16z" fill={B2} />
      <path d="M156 64v30" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="156" cy="98" r="5" fill="#f59e0b" />
      {[[30, 30], [176, 36], [20, 112], [182, 120]].map(([x, y]) => <path key={x} d={`M${x} ${y - 6}v12M${x - 6} ${y}h12`} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />)}
    </svg>
  );
}

export function StudyIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 200 160" className={className} role="img" aria-label="Books and laptop">
      <ellipse cx="100" cy="140" rx="80" ry="8" fill={LINE} />
      <rect x="28" y="112" width="70" height="14" rx="3" fill="#f59e0b" />
      <rect x="34" y="98" width="62" height="14" rx="3" fill="#10b981" />
      <rect x="24" y="84" width="68" height="14" rx="3" fill={B} />
      <rect x="104" y="70" width="72" height="48" rx="5" fill="#1e293b" />
      <rect x="109" y="75" width="62" height="38" rx="2" fill={SOFT} />
      <rect x="114" y="82" width="30" height="4" rx="2" fill={B} /><rect x="114" y="90" width="44" height="4" rx="2" fill={B2} opacity=".6" /><rect x="114" y="98" width="24" height="4" rx="2" fill="#10b981" />
      <path d="M96 120h88l-6 8H102z" fill="#334155" />
      <path d="M150 54c0-14 14-22 14-22s4 14-6 22" fill="#34d399" /><path d="M150 54c-4-10-16-12-16-12s0 12 12 14" fill="#10b981" />
      <rect x="144" y="54" width="12" height="16" rx="2" fill="#fb923c" />
    </svg>
  );
}

export function CareerIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 200 160" className={className} role="img" aria-label="Career growth">
      <circle cx="100" cy="80" r="66" fill={SOFT} />
      {[[52, 96, 30], [80, 82, 44], [108, 64, 62], [136, 46, 80]].map(([x, y, h]) => <rect key={x} x={x} y={y} width="20" height={h} rx="4" fill={B} opacity={0.35 + x / 300} />)}
      <path d="M48 104 76 86l28-14 30-24 18-10" stroke="#f59e0b" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M142 36h12v12" stroke="#f59e0b" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="30" y="112" width="44" height="30" rx="5" fill={B2} />
      <rect x="44" y="106" width="16" height="8" rx="3" fill="none" stroke={B2} strokeWidth="3" />
      <rect x="30" y="122" width="44" height="3" fill={SURF} opacity=".5" />
    </svg>
  );
}

export function EmptyIllustration({ className }: P) {
  // Three glossy violet cubes (the empty-state art of the ICL theme).
  const cube = (x: number, y: number, k: string) => (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 12 L22 0 L44 12 L22 24 Z" fill={`url(#top${k})`} />
      <path d="M0 12 L22 24 L22 50 L0 38 Z" fill={`url(#left${k})`} />
      <path d="M44 12 L22 24 L22 50 L44 38 Z" fill={`url(#right${k})`} />
      <path d="M0 12 L22 0 L44 12" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
    </g>
  );
  const grads = (k: string) => (
    <>
      <linearGradient id={`top${k}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ede9fe" /><stop offset="1" stopColor="#c4b5fd" /></linearGradient>
      <linearGradient id={`left${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#7c3aed" /></linearGradient>
      <linearGradient id={`right${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#5b21b6" /></linearGradient>
    </>
  );
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label="Nothing here">
      <defs>{grads("a")}</defs>
      <ellipse cx="80" cy="108" rx="46" ry="6" fill="#ddd6fe" opacity=".55" />
      {cube(58, 8, "a")}
      {cube(36, 46, "a")}
      {cube(80, 46, "a")}
      <circle cx="24" cy="84" r="2" fill="#c4b5fd" />
      <circle cx="136" cy="30" r="1.6" fill="#c4b5fd" />
    </svg>
  );
}

export function ScheduleIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 200 160" className={className} role="img" aria-label="Calendar">
      <rect x="36" y="34" width="128" height="104" rx="10" fill={SURF} stroke={LINE} strokeWidth="2" />
      <rect x="36" y="34" width="128" height="26" rx="10" fill={B} />
      <rect x="36" y="50" width="128" height="10" fill={B} />
      {[60, 100, 140].map((x) => <rect key={x} x={x - 4} y="26" width="8" height="16" rx="4" fill={B2} />)}
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
        <rect key={`${r}${c}`} x={50 + c * 27} y={70 + r * 21} width="20" height="14" rx="3" fill={(r + c) % 3 === 0 ? "#f59e0b" : SOFT} opacity={(r + c) % 3 === 0 ? 0.9 : 1} />
      )))}
      <circle cx="160" cy="128" r="18" fill="#10b981" /><path d="m151 128 6 6 12-12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
