import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD_BYTES } from "@/lib/hosting";
import { storageDriver } from "./driver";

/**
 * Storage abstraction. The driver (see ./driver.ts) picks where file bytes live:
 * - "disk": STORAGE_DIR on a persistent disk (Docker, Railway volume).
 * - "database": the StoredFile table, for hosts without a lasting disk. Default on serverless builds (Netlify).
 */
export interface StorageProvider {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalDiskStorage implements StorageProvider {
  private root = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_DIR ?? "./storage");
  private full(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("INVALID_KEY");
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.full(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async get(key: string) {
    return readFile(this.full(key));
  }
  async remove(key: string) {
    await unlink(this.full(key)).catch(() => undefined);
  }
}

class DatabaseStorage implements StorageProvider {
  async put(key: string, data: Buffer, mime: string) {
    const bytes = new Uint8Array(data);
    await prisma.storedFile.upsert({ where: { key }, create: { key, mimeType: mime, size: bytes.length, data: bytes }, update: { mimeType: mime, size: bytes.length, data: bytes } });
  }
  async get(key: string) {
    const row = await prisma.storedFile.findUnique({ where: { key }, select: { data: true } });
    if (!row) throw new Error("NOT_FOUND");
    return Buffer.from(row.data);
  }
  async remove(key: string) {
    await prisma.storedFile.deleteMany({ where: { key } });
  }
}

export const STORAGE_DRIVER = storageDriver();
export const storage: StorageProvider = STORAGE_DRIVER === "database" ? new DatabaseStorage() : new LocalDiskStorage();

export function buildStorageKey(companyId: string, entityType: string, fileName: string) {
  const ext = path.extname(fileName).toLowerCase().slice(0, 10);
  const d = new Date();
  return `${companyId}/${entityType}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${randomUUID()}${ext}`;
}

export function sha256(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

export const ALLOWED_MIME = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/csv", "text/plain",
]);
/** See MAX_UPLOAD_MB in src/lib/hosting.ts: 15 MB, or 4 MB on serverless builds. */
export const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;
