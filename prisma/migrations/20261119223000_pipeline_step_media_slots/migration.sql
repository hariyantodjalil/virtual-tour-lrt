-- Kembalikan slot dokumen per status: jangan biarkan OPTIONAL menampilkan semua tipe.
-- Tahap 2 (CONTACTED / RDS_OFFER) = 1 dokumen pendukung; negosiasi = LOI/surat/BA;
-- desain = DESIGN_APPROVAL; PKS/tagihan/fit-out = PKS_FINAL; lainnya = NONE.

UPDATE "pipeline_steps"
SET
  "mediaRequirement" = 'NONE',
  "requiresMedia" = false
WHERE "leadStatus" IN ('NEW', 'COMMERCIAL_OPERATION', 'CLOSED_LOST', 'CLOSED_WON');

UPDATE "pipeline_steps"
SET
  "mediaRequirement" = 'OPTIONAL',
  "requiresMedia" = false
WHERE "leadStatus" IN ('CONTACTED', 'RDS_OFFER', 'NEGOTIATING', 'SITE_CHECK');

UPDATE "pipeline_steps"
SET
  "mediaRequirement" = 'REQUIRED',
  "requiresMedia" = true
WHERE "leadStatus" IN ('BA_SIGNED', 'DESIGN_REVIEW', 'PKS', 'BILLING', 'FIT_OUT_HANDOVER');
