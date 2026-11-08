import type { ReactNode } from "react";
import {
  Activity, Award, BarChart3, BookOpen, Briefcase, Building2, CalendarDays, CheckCircle2, ClipboardCheck,
  Clock, FileText, Filter, GraduationCap, HandCoins, History, IdCard, LayoutGrid, ListChecks, Lock, Mail,
  Megaphone, MessageSquareHeart, Palette, PieChart, Plus, ScrollText, Settings, ShieldCheck, Target, TrendingUp, Upload,
  UserCircle, UserPlus, Users, AlertTriangle, Shapes, Wrench, Phone, Eye,
} from "lucide-react";

/** Keyword (in the card's English title) → icon and chip colour. The first match wins, so specific words come first. */
const MAP: [RegExp, typeof Activity, string][] = [
  [/^(add|new|record|publish a|post a|raise|schedule an?|issue an?|allot|open an|sign in a|log a|generate|create|assign a|share)/i, Plus, "chip-brand"],
  [/task/i, ListChecks, "chip-violet"],
  [/attention|shortage|risk|overdue|backlog|withheld|error/i, AlertTriangle, "chip-danger"],
  [/attendance|present|absent/i, ClipboardCheck, "chip-success"],
  [/timetable|today|schedule|calendar|coming up|term|week/i, CalendarDays, "chip-info"],
  [/scholarship/i, HandCoins, "chip-success"],
  [/placement|drive|recruit|offer|funnel|career/i, Briefcase, "chip-warning"],
  [/notice|announcement|circular/i, Megaphone, "chip-warning"],
  [/result|grade|cgpa|sgpa|marks|assessment|revaluation|grace/i, Award, "chip-violet"],
  [/exam|hall ticket|seating|invigilat|supplementary/i, FileText, "chip-violet"],
  [/outcome|co-po|attainment|accreditation/i, Target, "chip-violet"],
  [/elective/i, Shapes, "chip-violet"],
  [/feedback/i, MessageSquareHeart, "chip-pink"],
  [/syllabus|lesson|topic|coverage/i, ListChecks, "chip-info"],
  [/material|assignment|course|subject|curriculum|teaching|programme|program/i, BookOpen, "chip-info"],
  [/department|batch|section|academic/i, Building2, "chip-info"],
  [/student|alumni|demographic|gender|admission route|reservation|category/i, GraduationCap, "chip-brand"],
  [/admission|enquir|follow-up/i, UserPlus, "chip-pink"],
  [/faculty|staff|member|users?$|room-mate|parent|guardian|applicant|visitor/i, Users, "chip-pink"],
  [/profile|account|personal/i, UserCircle, "chip-pink"],
  [/certificate|bonafide|document/i, ScrollText, "chip-warning"],
  [/id card|identity/i, IdCard, "chip-info"],
  [/contact|call|whatsapp/i, Phone, "chip-warning"],
  [/report|chart|distribution|trend|progress|by programme|by year/i, BarChart3, "chip-brand"],
  [/split|mix|share/i, PieChart, "chip-violet"],
  [/activity|timeline|history|audit|log/i, History, "chip-neutral"],
  [/health|housekeeping|backup|system/i, ShieldCheck, "chip-success"],
  [/email|outbox|mail/i, Mail, "chip-info"],
  [/password|security|two-step/i, Lock, "chip-brand"],
  [/brand|logo|colour/i, Palette, "chip-pink"],
  [/setting|rules|preference|setup/i, Settings, "chip-neutral"],
  [/import|upload/i, Upload, "chip-brand"],
  [/filter/i, Filter, "chip-neutral"],
  [/preview/i, Eye, "chip-violet"],
  [/workload|growth|summary|key numbers|insight/i, TrendingUp, "chip-brand"],
  [/repair|maintenance/i, Wrench, "chip-warning"],
  [/waiting|pending|queue|request/i, Clock, "chip-warning"],
  [/done|complete|approved/i, CheckCircle2, "chip-success"],
  [/health|activity/i, Activity, "chip-success"],
];

/** The small tinted icon shown before a card title, chosen from the title's words. */
export function cardIcon(title: unknown): ReactNode {
  if (typeof title !== "string" || !title) return null;
  const hit = MAP.find(([re]) => re.test(title));
  const [, Icon, chip] = hit ?? [null, LayoutGrid, "chip-brand"];
  return <span aria-hidden className={`chip-soft size-8 ${chip}`}><Icon className="size-4" /></span>;
}

/** The gradient icon for a number tile, chosen from its label, with the tile's own colour when it has one. */
export function statIcon(label: string, chipClass?: string): ReactNode {
  const hit = MAP.slice(1).find(([re]) => re.test(label));
  const [, Icon, chip] = hit ?? [null, TrendingUp, "chip-brand"];
  return <span aria-hidden className={`chip size-9 [&_svg]:size-[18px] ${chipClass ?? chip}`}><Icon /></span>;
}
