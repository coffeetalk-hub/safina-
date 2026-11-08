import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

/** Storage abstraction. Local disk now; swap for S3-compatible later. */
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

export const storage: StorageProvider = new LocalDiskStorage();

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
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
