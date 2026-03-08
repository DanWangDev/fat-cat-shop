import { cookies } from "next/headers";
import crypto from "crypto";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
}

const SESSION_COOKIE = "fat-cat-session";

const SCRYPT_KEYLEN = 64;

function getSessionSecret(): string {
  return requireEnv("SESSION_SECRET");
}

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

function verify(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  return payload;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey));
    });
  });
}

export function validateCredentials(username: string, password: string): boolean {
  return username === requireEnv("ADMIN_USERNAME") && password === requireEnv("ADMIN_PASSWORD");
}

export function getEnvCredentials() {
  return { username: requireEnv("ADMIN_USERNAME"), password: requireEnv("ADMIN_PASSWORD") };
}

export async function createSession(user: { userId: string; username: string }) {
  const payload = JSON.stringify({
    userId: user.userId,
    username: user.username,
    iat: Date.now(),
  });
  const token = sign(Buffer.from(payload).toString("base64url"));

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

interface SessionPayload {
  userId: string;
  username: string;
}

function parseSessionPayload(token: string): SessionPayload | null {
  const raw = verify(token);
  if (!raw) return null;

  try {
    const data = JSON.parse(Buffer.from(raw, "base64url").toString());
    // Check token is not older than 1 day
    if (Date.now() - data.iat > 24 * 60 * 60 * 1000) return null;

    if (data.userId && data.username) {
      return { userId: data.userId, username: data.username };
    }

    return null;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return parseSessionPayload(token) !== null;
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return parseSessionPayload(token);
}
