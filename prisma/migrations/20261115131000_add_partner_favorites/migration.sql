-- CreateTable
CREATE TABLE "partner_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_favorites_userId_createdAt_idx" ON "partner_favorites"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "partner_favorites_userId_spaceId_key" ON "partner_favorites"("userId", "spaceId");

-- AddForeignKey
ALTER TABLE "partner_favorites" ADD CONSTRAINT "partner_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_favorites" ADD CONSTRAINT "partner_favorites_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "commercial_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
