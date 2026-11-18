-- Existing CMS contact values stay intact. New profiles have no assumed number.
ALTER TABLE "commercial_profiles" ALTER COLUMN "whatsappNumber" SET DEFAULT '';
