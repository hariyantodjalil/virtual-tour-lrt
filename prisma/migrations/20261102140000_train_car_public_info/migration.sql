-- Informasi publik per gerbong: deskripsi dan fasilitas.
ALTER TABLE "train_tour_cars" ADD COLUMN "description" TEXT;
ALTER TABLE "train_tour_cars" ADD COLUMN "facilities" TEXT[] DEFAULT ARRAY[]::TEXT[];
