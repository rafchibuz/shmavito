import { UserRole, UserStatus } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

export const SESSION_COOKIE = "shmavito_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    priority: "high" as const,
  };
}

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        twitchId: true,
        login: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Войдите через Twitch.");
  if (user.status === UserStatus.BLOCKED) {
    throw new ApiError(403, "ACCOUNT_BLOCKED", "Аккаунт заблокирован.");
  }
  return user;
}

export async function requireModerator() {
  const user = await requireUser();
  if (user.role !== UserRole.MODERATOR && user.role !== UserRole.FOUNDER) {
    throw new ApiError(403, "FORBIDDEN", "Нужны права модератора.");
  }
  return user;
}

export async function requireFounder() {
  const user = await requireUser();
  if (user.role !== UserRole.FOUNDER) {
    throw new ApiError(403, "FORBIDDEN", "Нужны права основателя.");
  }
  return user;
}
