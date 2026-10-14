import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { getInstitution } from "@/lib/institution";
import { fmtDate } from "@/lib/format";
import { LANG_COOKIE, LANGS, dictionary, type Lang } from "@/lib/i18n";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [notices, term, inst, jar] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 7, select: { id: true, title: true, createdAt: true, readAt: true } }),
    currentTerm(),
    getInstitution(),
    cookies(),
  ]);
  const raw = jar.get(LANG_COOKIE)?.value;
  const lang: Lang = raw && raw in LANGS ? (raw as Lang) : "en";
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, role: user.role, hasPhoto: user.hasPhoto, children: user.children, studentId: user.studentId }}
      termName={term?.name}
      brand={{ name: inst.name, shortName: inst.shortName, tagline: inst.tagline, hasLogo: !!inst.logoType }}
      lang={lang}
      dict={dictionary(lang)}
      unread={unread}
      notices={notices.map((n) => ({ id: n.id, title: n.title, date: fmtDate(n.createdAt), fresh: !n.readAt }))}
    >
      {children}
    </AppShell>
  );
}
