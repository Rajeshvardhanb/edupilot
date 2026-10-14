import { BrandMark } from "@/components/brand-mark";
import { getInstitution } from "@/lib/institution";

/** College header for printable documents. Uses the name, logo and address from Administration → Branding. */
export async function Letterhead({ title, serial }: { title?: string; serial?: string }) {
  const inst = await getInstitution();
  return (
    <div className="flex items-center justify-between gap-4 border-b-2 border-fg/80 pb-4">
      <div className="flex items-center gap-3">
        {inst.logoType
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src="/brand/logo" alt="" className="size-14 object-contain" />
          : <BrandMark size={52} />}
        <div>
          <p className="text-lg leading-tight font-bold tracking-tight uppercase">{inst.name}</p>
          <p className="text-xs text-muted">{inst.affiliation}</p>
          {inst.address && <p className="text-xs text-muted">{inst.address}{inst.phone && ` · ${inst.phone}`}</p>}
        </div>
      </div>
      {(title || serial) && <div className="text-right">{title && <p className="text-xs font-semibold tracking-widest text-muted uppercase">{title}</p>}{serial && <p className="font-mono text-sm font-semibold">{serial}</p>}</div>}
    </div>
  );
}

/** A4-ish sheet used for printable pages; chrome is hidden when printing. */
export function Sheet({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-8 shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">{children}</div>;
}
