-- CreateTable
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isMaintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT DEFAULT 'Situs Virtual Tour LRT Jabodebek sedang dalam pemeliharaan sistem. Silakan kembali beberapa saat lagi.',
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- Insert default row if not exists
INSERT INTO "system_settings" ("id", "isMaintenanceMode", "maintenanceMessage", "updatedAt")
VALUES ('default', false, 'Situs Virtual Tour LRT Jabodebek sedang dalam pemeliharaan sistem. Silakan kembali beberapa saat lagi.', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
