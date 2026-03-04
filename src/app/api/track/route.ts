import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const trackSchema = z.object({
  event: z.string().min(1).max(50),
  path: z.string().min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    let visitorId = req.cookies.get("visitor_id")?.value;
    const isNewVisitor = !visitorId;
    if (!visitorId) {
      visitorId = nanoid();
    }

    const now = new Date().toISOString();
    db.insert(analyticsEvents)
      .values({
        id: nanoid(),
        visitorId,
        event: parsed.data.event,
        path: parsed.data.path,
        referrer: req.headers.get("referer") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
        metadata: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
        createdAt: now,
      })
      .run();

    const response = NextResponse.json({ ok: true });
    if (isNewVisitor) {
      response.cookies.set("visitor_id", visitorId, {
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
