// Puts a college's name, contact details, colour and logo into the app (the same fields as Administration →
// Branding). Usage: DATABASE_URL=… npx tsx scripts/deploy/brand.mts <details.json> [logo.png|jpg]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const [file, logo] = process.argv.slice(2);
if (!file) throw new Error("Usage: brand.mts <details.json> [logo]");
const fields = ["name", "shortName", "tagline", "affiliation", "address", "phone", "email", "principalName", "brandColor"] as const;
const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
const data = Object.fromEntries(fields.filter((k) => typeof raw[k] === "string").map((k) => [k, raw[k]]));
const db = new PrismaClient();
await db.institution.upsert({
  where: { id: 1 },
  create: { id: 1, ...data, ...(logo && { logo: readFileSync(logo), logoType: logo.endsWith(".png") ? "image/png" : "image/jpeg" }) },
  update: { ...data, ...(logo && { logo: readFileSync(logo), logoType: logo.endsWith(".png") ? "image/png" : "image/jpeg" }) },
});
console.log(`branded as ${data.name ?? "(unchanged name)"}${logo ? " with logo" : ""}`);
await db.$disconnect();
