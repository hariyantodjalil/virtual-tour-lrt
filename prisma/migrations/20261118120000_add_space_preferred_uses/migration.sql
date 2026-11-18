-- Preferensi peruntukan unit untuk modal detail ruang publik.
ALTER TABLE "commercial_spaces" ADD COLUMN IF NOT EXISTS "preferredUses" TEXT[] DEFAULT ARRAY[]::TEXT[];
