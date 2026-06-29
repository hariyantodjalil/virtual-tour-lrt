ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MITRA';

ALTER TABLE "tenant_leads"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "tenant_leads"
ADD CONSTRAINT "tenant_leads_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "tenant_leads_userId_idx" ON "tenant_leads"("userId");
