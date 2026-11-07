import { cn } from "@/lib/utils";

/**
 * The EduPilot mark: a white paper plane on an indigo-to-magenta rounded square. The gradient is a CSS background,
 * not an SVG <linearGradient>, so every copy draws on its own (a gradient defined inside a hidden copy draws nothing).
 * `tile` is kept for older callers.
 */
export function BrandMark({ size = 36, className }: { size?: number; tile?: boolean; className?: string }) {
  return (
    <span
      role="img" aria-label="EduPilot"
      style={{ width: size, height: size, borderRadius: size * 0.275, backgroundImage: "linear-gradient(135deg, #6366f1, #8b5cf6 55%, #c026d3)" }}
      className={cn("inline-grid shrink-0 place-items-center", className)}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="8 8 24 24" aria-hidden>
        <path d="M29.5 10.5 9.8 18.6c-.9.4-.8 1.6.1 1.9l6.6 2.1 2.1 6.6c.3.9 1.5 1 1.9.1l8.1-19.7c.3-.7-.4-1.4-1.1-1.1Z" fill="#fff" />
        <path d="m16.5 22.6 12.5-11.6-9.4 13.7" fill="#e9d5ff" />
      </svg>
    </span>
  );
}

/** "EduPilot" set as in the ICL theme: "Edu" in ink, "Pilot" in the brand gradient. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-sans font-bold tracking-tight", className)}>Edu<span className="brand-text">Pilot</span></span>;
}
