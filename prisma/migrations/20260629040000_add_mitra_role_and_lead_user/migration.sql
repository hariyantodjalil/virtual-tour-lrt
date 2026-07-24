ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MITRA';

ALTER TABLE "tenant_leads"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_leads_userId_fkey'
  ) THEN
    ALTER TABLE "tenant_leads"
      ADD CONSTRAINT "tenant_leads_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tenant_leads_userId_idx" ON "tenant_leads"("userId");
