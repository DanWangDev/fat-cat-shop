import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { path: pathSegments } = await context.params;
  const filename = pathSegments.join("/");

  // Validate filename
  if (!/^[\w\-._]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "data", "uploads", filename);

  // Prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const uploadsDir = path.resolve(path.join(process.cwd(), "data", "uploads"));
  if (!resolvedPath.startsWith(uploadsDir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(resolvedPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const file = fs.readFileSync(resolvedPath);
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
  };

  return new NextResponse(file, {
    headers: {
      "Content-Type": contentTypes[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
