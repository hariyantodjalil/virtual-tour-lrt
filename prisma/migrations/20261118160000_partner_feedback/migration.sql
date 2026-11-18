-- Feedback mitra dari portal partner untuk dibaca di CMS.
CREATE TABLE IF NOT EXISTS "partner_feedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "partner_feedbacks_createdAt_idx" ON "partner_feedbacks"("createdAt");
CREATE INDEX IF NOT EXISTS "partner_feedbacks_userId_createdAt_idx" ON "partner_feedbacks"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_feedbacks_userId_fkey'
  ) THEN
    ALTER TABLE "partner_feedbacks"
      ADD CONSTRAINT "partner_feedbacks_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
