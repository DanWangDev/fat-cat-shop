import { NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import { getRequestId, jsonWithRequestId, logError, logInfo, logWarn } from "@/lib/logging";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

interface DetectedImageType {
  extension: "jpg" | "png" | "webp" | "gif" | "ico";
  mimeType: string;
}

function bytesMatch(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

function detectImageType(buffer: Buffer): DetectedImageType | null {
  // JPEG
  if (bytesMatch(buffer, [0xff, 0xd8, 0xff])) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  // PNG
  if (bytesMatch(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: "png", mimeType: "image/png" };
  }

  // GIF87a / GIF89a
  if (
    bytesMatch(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    bytesMatch(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { extension: "gif", mimeType: "image/gif" };
  }

  // WebP (RIFF....WEBP)
  if (
    bytesMatch(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    bytesMatch(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  // ICO
  if (bytesMatch(buffer, [0x00, 0x00, 0x01, 0x00]) && buffer.length >= 6) {
    const imageCount = buffer.readUInt16LE(4);
    if (imageCount < 1) {
      return null;
    }
    return { extension: "ico", mimeType: "image/x-icon" };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  if (!(await isAuthenticated())) {
    logWarn("Upload rejected due to missing auth", {
      requestId,
      route: "/api/upload",
    });
    return jsonWithRequestId(requestId, { error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      logWarn("Upload rejected with missing file payload", {
        requestId,
        route: "/api/upload",
      });
      return jsonWithRequestId(requestId, { error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      logWarn("Upload rejected due to file size", {
        requestId,
        route: "/api/upload",
        size: file.size,
      });
      return jsonWithRequestId(requestId, { error: "File too large. Max 10MB" }, { status: 400 });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = detectImageType(buffer);
    if (!detectedType) {
      logWarn("Upload rejected due to unsupported content signature", {
        requestId,
        route: "/api/upload",
        declaredMimeType: file.type || null,
        size: file.size,
      });
      return jsonWithRequestId(
        requestId,
        {
          error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, ICO. SVG is disabled.",
        },
        { status: 400 },
      );
    }

    const filename = `${nanoid()}.${detectedType.extension}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    logInfo("Upload stored successfully", {
      requestId,
      route: "/api/upload",
      filename,
      detectedMimeType: detectedType.mimeType,
      size: file.size,
    });

    return jsonWithRequestId(requestId, {
      url: `/uploads/${filename}`,
      filename,
    });
  } catch (err) {
    logError("Upload failed unexpectedly", {
      requestId,
      route: "/api/upload",
      error: err,
    });
    return jsonWithRequestId(requestId, { error: "Upload failed" }, { status: 500 });
  }
}
