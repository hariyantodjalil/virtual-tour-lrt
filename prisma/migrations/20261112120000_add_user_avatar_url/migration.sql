-- Kolom avatar pengguna sudah ada di DB lokal tetapi belum pernah dibuat oleh migrasi.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
