-- Notices tingkat trainset yang dipakai bersama seluruh gerbong.
ALTER TABLE "trains" ADD COLUMN "infoNotices" JSONB NOT NULL DEFAULT '[]'::JSONB;
