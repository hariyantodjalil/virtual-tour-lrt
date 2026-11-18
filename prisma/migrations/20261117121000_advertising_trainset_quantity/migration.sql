ALTER TABLE "train_inquiries" DROP CONSTRAINT "train_inquiries_request_count_check";
ALTER TABLE "train_inquiries" ADD CONSTRAINT "train_inquiries_request_count_check"
  CHECK ("requestedTrainsetCount" IS NULL OR "requestedTrainsetCount" > 0);
