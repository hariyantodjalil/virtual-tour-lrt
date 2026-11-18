-- The tariff remains NULL until confirmed in the CMS.
ALTER TABLE "commercial_spaces" ALTER COLUMN "monthlyRent" DROP NOT NULL;
