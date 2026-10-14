import { cn } from "@/lib/utils";

/**
 * The EduPilot mark. `tile` puts it on a white rounded square, for use on coloured backgrounds
 * (the mark itself is blue, so it needs a light surface behind it there).
 */
export function BrandMark({ size = 36, tile, className }: { size?: number; tile?: boolean; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={size > 96 ? "/brand/mark.png" : size > 48 ? "/brand/mark-192.png" : "/brand/mark-96.png"} alt="EduPilot" width={tile ? Math.round(size * 0.78) : size} height={tile ? Math.round(size * 0.78) : size} className={tile ? undefined : cn("shrink-0", className)} />;
  if (!tile) return img;
  return <span style={{ width: size, height: size }} className={cn("grid shrink-0 place-items-center rounded-xl bg-white shadow-sm", className)}>{img}</span>;
}
