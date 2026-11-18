-- Notices fleksibel per gerbong (judul + isi, urutan tampil).
ALTER TABLE "train_tour_cars" ADD COLUMN "infoNotices" JSONB NOT NULL DEFAULT '[]'::JSONB;
