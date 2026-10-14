import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, LANGS, translator, type Lang } from "./i18n";

/** Translator for the signed-in user's chosen language, for use in Server Components. One cookie read per request. */
export const getT = cache(async () => {
  const raw = (await cookies()).get(LANG_COOKIE)?.value;
  return translator(raw && raw in LANGS ? (raw as Lang) : "en");
});
