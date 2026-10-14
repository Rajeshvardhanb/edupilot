import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

// Edge-safe session helpers (used by both proxy.ts and server code).
export const SESSION_COOKIE = "edupilot_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SessionPayload = { sub: string; role: Role; name: string; iat?: number };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { sub: payload.sub!, role: payload.role as Role, name: payload.name as string, iat: payload.iat };
  } catch {
    return null;
  }
}

// Two-step sign-in: after the password is accepted, this cookie holds who is signing in until the emailed code is entered.
export const PENDING_COOKIE = "edupilot_pending";
export const PENDING_TTL_SECONDS = 60 * 10;

export async function signPending(userId: string) {
  return new SignJWT({ purpose: "2fa" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${PENDING_TTL_SECONDS}s`).sign(key());
}

export async function verifyPending(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.purpose === "2fa" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
