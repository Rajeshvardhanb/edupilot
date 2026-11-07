"use client";

import { setLanguage } from "@/actions/prefs";
import { LANGS, type Lang } from "@/lib/i18n";

/** Language picker that applies as soon as a language is chosen. */
export function LanguageSelect({ lang, label = "Language", className }: { lang: Lang; label?: string; className?: string }) {
  return (
    <form action={setLanguage}>
      <select name="lang" defaultValue={lang} aria-label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={className ?? "input w-auto"}>
        {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </form>
  );
}
