import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { isAuthenticated, hashPassword } from "@/lib/auth";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const createAdminSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.email("Invalid email address"),
  displayName: z.string().min(1, "Display name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/\d/, "Password must contain a digit"),
});

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      createdAt: adminUsers.createdAt,
      lastLoginAt: adminUsers.lastLoginAt,
    })
    .from(adminUsers)
    .all();

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createAdminSchema.parse(body);

    // Check unique username
    const existingUsername = db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, parsed.username))
      .get();

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 },
      );
    }

    // Check unique email
    const existingEmail = db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, parsed.email))
      .get();

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const passwordHash = await hashPassword(parsed.password);

    const newUser = {
      id: nanoid(),
      username: parsed.username,
      email: parsed.email,
      displayName: parsed.displayName,
      passwordHash,
      createdAt: now,
      lastLoginAt: null,
    };

    db.insert(adminUsers).values(newUser).run();

    return NextResponse.json(
      {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        displayName: newUser.displayName,
        createdAt: newUser.createdAt,
        lastLoginAt: newUser.lastLoginAt,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create admin" },
      { status: 400 },
    );
  }
}
