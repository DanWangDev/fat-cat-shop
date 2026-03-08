import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import {
  createSession,
  hashPassword,
  verifyPassword,
  getEnvCredentials,
} from "@/lib/auth";
import { nanoid } from "nanoid";
import { z } from "zod/v4";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 minutes per IP
    const ip = getClientIp(req);
    const limit = checkRateLimit(`login:${ip}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const body = await req.json();
    const parsed = loginSchema.parse(body);

    // Check DB for matching admin user
    const dbUser = db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, parsed.username))
      .get();

    if (dbUser) {
      const valid = await verifyPassword(parsed.password, dbUser.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 },
        );
      }

      // Update lastLoginAt
      db.update(adminUsers)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(adminUsers.id, dbUser.id))
        .run();

      await createSession({ userId: dbUser.id, username: dbUser.username });
      return NextResponse.json({ success: true });
    }

    // If table is empty, fall back to env-var credentials
    const allAdmins = db.select().from(adminUsers).all();
    if (allAdmins.length > 0) {
      // DB has users but none matched
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Fallback to env vars
    const envCreds = getEnvCredentials();
    if (parsed.username !== envCreds.username || parsed.password !== envCreds.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Auto-create DB admin record on first env-var login
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(parsed.password);
    const newUser = {
      id: nanoid(),
      username: envCreds.username,
      email: `${envCreds.username}@localhost`,
      passwordHash,
      displayName: "Admin",
      createdAt: now,
      lastLoginAt: now,
    };

    db.insert(adminUsers).values(newUser).run();

    await createSession({ userId: newUser.id, username: newUser.username });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 },
    );
  }
}
