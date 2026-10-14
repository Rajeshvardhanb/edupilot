import "server-only";
import { PrismaClient } from "@prisma/client";

// Binary columns are never loaded implicitly; download routes opt back in.
const createClient = () =>
  new PrismaClient({ omit: { user: { photo: true }, institution: { logo: true }, material: { file: true }, submission: { file: true } } });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
