import { z } from "zod";
const text = (max: number) => z.string().trim().max(max).transform(v => v || null);
const phone = text(15).refine(v => !v || /^[\d+()\- ]{7,15}$/.test(v), "Enter a valid phone number");
const email = text(254).refine(v => !v || z.email().safeParse(v).success, "Enter a valid email address");
const link = text(190).refine(v => { if (!v) return true; try { return ["https:", "http:"].includes(new URL(v).protocol); } catch { return false; } }, "Use a valid https:// or http:// link");
export const accountProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(150),
  email: z.email("Enter a valid email address").transform(v => v.trim().toLowerCase()),
  phone,
});
export const personalProfileSchema = z.object({
  dob: z.string().refine(v => !v || z.iso.date().safeParse(v).success && v <= new Date().toISOString().slice(0, 10), "Enter a valid date of birth in the past").transform(v => v ? new Date(`${v}T00:00:00Z`) : null),
  gender: z.enum(["MALE", "FEMALE", "OTHER", ""]).transform(v => v || null),
  bloodGroup: text(5), address: text(1000), guardianName: text(150), guardianPhone: phone, guardianEmail: email,
  about: text(1500), skills: text(500), linkedin: link, github: link,
});
