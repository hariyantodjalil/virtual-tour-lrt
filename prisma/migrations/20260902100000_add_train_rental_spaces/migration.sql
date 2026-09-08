-- CreateTable
CREATE TABLE "train_rental_spaces" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "displayNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "objectPosition" TEXT NOT NULL DEFAULT '50% 50%',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "train_rental_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "train_rental_spaces_trainId_isActive_order_idx" ON "train_rental_spaces"("trainId", "isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "train_rental_spaces_trainId_displayNumber_key" ON "train_rental_spaces"("trainId", "displayNumber");

-- AddForeignKey
ALTER TABLE "train_rental_spaces" ADD CONSTRAINT "train_rental_spaces_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
