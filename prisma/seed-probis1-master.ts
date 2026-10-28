import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const KAI_V1_STEPS = [
  {
    stepOrder: 1,
    title: "Lead Qualification & RDS Offer",
    description:
      "Tim Komersial menghubungi calon mitra, memverifikasi konsep usaha, dan menerbitkan Surat Penawaran Resmi melalui RDS KAI.",
    publicMessage:
      "Pengajuan Anda telah diterima. Tim Komersial LRT Jabodebek akan segera menghubungi Anda melalui WhatsApp/Email untuk kualifikasi awal dan penerbitan Surat Penawaran Resmi (RDS KAI).",
    requiresMedia: true,
  },
  {
    stepOrder: 2,
    title: "Negotiation & Preliminary Alignment",
    description:
      "Kesepakatan awal mengenai harga sewa, luasan ruang, masa sewa, dan peruntukan usaha.",
    publicMessage:
      "Surat penawaran telah diterbitkan. Silakan tinjau penawaran tersebut untuk menyepakati besaran tarif sewa, durasi kerja sama, dan ketentuan komersial awal bersama Tim Komersial.",
    requiresMedia: false,
  },
  {
    stepOrder: 3,
    title: "Final Site Visit & Technical Check",
    description:
      "Peninjauan langsung batas area, kendala fit-out, sirkulasi penumpang, dan kesiapan utilitas di stasiun.",
    publicMessage:
      "Tim Komersial dan Teknis menjadwalkan peninjauan lokasi (Site Visit) bersama Anda di stasiun untuk memastikan batas area, jalur utilitas, dan kelayakan teknis dasar.",
    requiresMedia: true,
  },
  {
    stepOrder: 4,
    title: "Commercial Agreement — BA Negotiation",
    description:
      "Konfirmasi ketentuan akhir dan penandatanganan Berita Acara (BA) Negosiasi sebagai dasar komersial.",
    publicMessage:
      "Peninjauan lokasi selesai. Tahap ini mencakup finalisasi kesepakatan komersial dan penandatanganan Berita Acara (BA) Negosiasi resmi.",
    requiresMedia: true,
  },
  {
    stepOrder: 5,
    title: "Detailed Technical Design Review",
    description:
      "Mitra menyerahkan gambar layout outlet, diagram kelistrikan, dan rencana fit-out untuk ditinjau tim teknis.",
    publicMessage:
      "Silakan ajukan dokumen desain teknis rinci (layout outlet, diagram kelistrikan, utilitas, dan rencana fit-out) kepada Tim Teknis KAI untuk diverifikasi.",
    requiresMedia: true,
  },
  {
    stepOrder: 6,
    title: "PKS Drafting & Registration",
    description:
      "Penyusunan dan penandatanganan draf Perjanjian Kerja Sama (PKS) secara paralel setelah isu teknis terpenuhi.",
    publicMessage:
      "Draf Perjanjian Kerja Sama (PKS) sedang disusun dan diregistrasi. Pastikan seluruh persyaratan administrasi dan teknis telah lengkap sebelum penandatanganan PKS.",
    requiresMedia: true,
  },
  {
    stepOrder: 7,
    title: "PKS • Billing • Handover",
    description:
      "Penandatanganan PKS, penerbitan tagihan Virtual Account, verifikasi pembayaran, dan serah terima unit.",
    publicMessage:
      "Selamat! PKS telah diselesaikan. Silakan lakukan pembayaran sesuai instruksi tagihan resmi KAI untuk proses Berita Acara Serah Terima (BAST) dan mulai beroperasi.",
    requiresMedia: true,
  },
];

function defaultAreaDetail(area: number): string {
  if (area === 4) return "4 m² (2 × 2 m)";
  if (area === 2) return "2 m² (1.5 × 1.3 m)";
  if (area === 6) return "6 m² (3 × 2 m)";
  if (area === 12) return "12 m² (4 × 3 m)";
  if (area === 20) return "20 m² (5 × 4 m)";
  if (area === 48) return "48 m² (8 × 6 m)";
  return `${area} m²`;
}

async function main() {
  console.log("Menjalankan seeding non-destruktif Master Data Probis 1...");

  // 1. Upsert Workflow V1 (ACTIVE)
  const v1 = await prisma.pipelineWorkflowVersion.upsert({
    where: { version: 1 },
    update: {
      title: "Standar Leasing KAI LRT Jabodebek V1",
      description: "Alur standar 7 tahapan penyewaan ruang komersial stasiun LRT Jabodebek (Commercial Gate Before Design).",
      status: "ACTIVE",
      publishedAt: new Date(),
    },
    create: {
      version: 1,
      title: "Standar Leasing KAI LRT Jabodebek V1",
      description: "Alur standar 7 tahapan penyewaan ruang komersial stasiun LRT Jabodebek (Commercial Gate Before Design).",
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });

  for (const step of KAI_V1_STEPS) {
    await prisma.pipelineStep.upsert({
      where: {
        workflowVersionId_stepOrder: {
          workflowVersionId: v1.id,
          stepOrder: step.stepOrder,
        },
      },
      update: {
        title: step.title,
        description: step.description,
        publicMessage: step.publicMessage,
        requiresMedia: step.requiresMedia,
      },
      create: {
        workflowVersionId: v1.id,
        stepOrder: step.stepOrder,
        title: step.title,
        description: step.description,
        publicMessage: step.publicMessage,
        requiresMedia: step.requiresMedia,
      },
    });
  }
  console.log(`  ok Workflow V1 (${KAI_V1_STEPS.length} tahapan) aktif.`);

  // 2. Backfill Spesifikasi Teknis CommercialSpace
  const spaces = await prisma.commercialSpace.findMany();
  for (const space of spaces) {
    const waterVal =
      !space.waterAccess || space.waterAccess === "false"
        ? "Subject to Technical Review"
        : space.waterAccess === "true"
          ? "Clean Water Pipe Ready"
          : space.waterAccess;

    const acVal =
      !space.airConditioning || space.airConditioning === "false"
        ? "Subject to Technical Review"
        : space.airConditioning === "true"
          ? "Station Central AC"
          : space.airConditioning;

    await prisma.commercialSpace.update({
      where: { id: space.id },
      data: {
        leasableAreaDetail: space.leasableAreaDetail || defaultAreaDetail(space.area),
        leasingModel: space.leasingModel || "Space-Only Leasing",
        powerSupply: space.powerSupply || "Tenant-Provided",
        waterAccess: waterVal,
        airConditioning: acVal,
        fitOutTerms: space.fitOutTerms || "By Tenant • Approval Required",
      },
    });
  }
  console.log(`  ok ${spaces.length} unit CommercialSpace diperbarui spesifikasi teknisnya.`);

  // 3. Backfill TenantLead eksisting
  const leads = await prisma.tenantLead.findMany({
    orderBy: { createdAt: "asc" },
  });
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const oldStatus = lead.status;
    let nextStatus = "ACTIVE";
    let stepOrder = lead.currentStepOrder || 1;

    if (oldStatus === "COMMERCIAL_OPERATION" || oldStatus === "CLOSED_WON" || oldStatus === "COMPLETED") {
      nextStatus = "COMPLETED";
      stepOrder = 7;
    } else if (oldStatus === "CLOSED_LOST" || oldStatus === "REJECTED") {
      nextStatus = "REJECTED";
    } else if (oldStatus === "FIT_OUT_HANDOVER") {
      stepOrder = 6;
    } else if (oldStatus === "PKS") {
      stepOrder = 5;
    } else if (oldStatus === "NEGOTIATING") {
      stepOrder = 2;
    }

    const code =
      lead.inquiryCode ||
      `INQ-${lead.createdAt.getFullYear()}-${String(i + 1).padStart(4, "0")}`;

    await prisma.tenantLead.update({
      where: { id: lead.id },
      data: {
        inquiryCode: code,
        status: nextStatus,
        workflowVersionId: lead.workflowVersionId || v1.id,
        currentStepOrder: stepOrder,
      },
    });
  }
  console.log(`  ok ${leads.length} data TenantLead dimigrasikan ke Workflow V1.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
