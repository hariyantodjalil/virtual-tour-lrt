import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Penyimpanan file lokal khusus development — pengganti S3 saat object storage tim tidak bisa diakses
 * dari laptop (mis. S3_ENDPOINT masih nilai contoh). Aktif hanya bila STORAGE_DRIVER=local dan bukan
 * production, sehingga server dev/prod tim tetap memakai S3.
 *
 * Key yang sama dengan S3 (mis. "virtual-tour/panoramas/cawang/panorama_x.webp") disimpan sebagai file
 * di LOCAL_STORAGE_DIR (default ".local-storage/") dan dibaca lagi lewat /api/s3-proxy.
 */
export function isLocalStorageEnabled() {
  return process.env.STORAGE_DRIVER === "local" && process.env.NODE_ENV !== "production";
}

function storageRoot() {
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || ".local-storage");
}

/** Path file untuk sebuah key; menolak key yang keluar dari folder penyimpanan. */
function resolveKey(key: string) {
  const root = storageRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Key penyimpanan lokal tidak valid");
  return full;
}

export async function writeLocalObject(key: string, body: Buffer) {
  const file = resolveKey(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

/** Isi file, atau null bila belum ada. */
export async function readLocalObject(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveKey(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteLocalObject(key: string) {
  await fs.rm(resolveKey(key), { force: true });
}
