import "server-only";
import { PrismaClient } from "@prisma/client";
import { presentationRead } from "./student-visibility";

// Binary columns are never loaded implicitly; download routes opt back in.
const createClient = () =>
  new PrismaClient({ omit: { user: { photo: true }, institution: { logo: true }, material: { file: true }, submission: { file: true } } }).$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(presentationRead(model, operation, args as Record<string, unknown>) as typeof args);
        },
      },
    },
  });

const globalForPrisma = globalThis as unknown as { presentationPrisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.presentationPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.presentationPrisma = db;
