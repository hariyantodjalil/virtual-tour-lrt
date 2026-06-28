import { PrismaClient, SpaceStatus, SpaceType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const stations = [
  { name: "Dukuh Atas BNI", slug: "dukuh-atas", line: "Jabodebek", address: "Jl. Jend. Sudirman, Jakarta Pusat", dailyPassengers: 45000, order: 1 },
  { name: "Setiabudi Astra", slug: "setiabudi", line: "Jabodebek", address: "Jl. HR Rasuna Said, Jakarta Selatan", dailyPassengers: 32000, order: 2 },
  { name: "Rasuna Said", slug: "rasuna-said", line: "Jabodebek", address: "Jl. HR Rasuna Said, Jakarta Selatan", dailyPassengers: 28000, order: 3 },
  { name: "Kuningan", slug: "kuningan", line: "Jabodebek", address: "Jl. Prof. Dr. Satrio, Jakarta Selatan", dailyPassengers: 35000, order: 4 },
  { name: "Pancoran", slug: "pancoran", line: "Jabodebek", address: "Jl. MT Haryono, Jakarta Selatan", dailyPassengers: 22000, order: 5 },
  { name: "Cikoko", slug: "cikoko", line: "Jabodebek", address: "Jl. Cikoko Barat, Jakarta Selatan", dailyPassengers: 18000, order: 6 },
  { name: "Ciliwung", slug: "ciliwung", line: "Jabodebek", address: "Jl. MT Haryono, Jakarta Timur", dailyPassengers: 16000, order: 7 },
  { name: "Cawang", slug: "cawang", line: "Jabodebek", address: "Jl. Mayjen Sutoyo, Jakarta Timur", dailyPassengers: 38000, order: 8 },
  { name: "TMII", slug: "tmii", line: "Jabodebek", address: "Jl. Raya Taman Mini, Jakarta Timur", dailyPassengers: 25000, order: 9 },
  { name: "Kampung Rambutan", slug: "kampung-rambutan", line: "Jabodebek", address: "Jl. Raya Bogor, Jakarta Timur", dailyPassengers: 42000, order: 10 },
  { name: "Ciracas", slug: "ciracas", line: "Jabodebek", address: "Jl. Raya Ciracas, Jakarta Timur", dailyPassengers: 19000, order: 11 },
  { name: "Harjamukti", slug: "harjamukti", line: "Jabodebek", address: "Jl. Transyogi, Cibubur", dailyPassengers: 28000, order: 12 },
  { name: "Jatibening Baru", slug: "jatibening-baru", line: "Jabodebek", address: "Jl. Raya Bekasi, Bekasi Barat", dailyPassengers: 21000, order: 13 },
  { name: "Halim", slug: "halim", line: "Jabodebek", address: "Jl. Raya Halim, Jakarta Timur", dailyPassengers: 31000, order: 14 },
  { name: "Jatimulya", slug: "jatimulya", line: "Jabodebek", address: "Jl. Jatimulya, Bekasi", dailyPassengers: 24000, order: 15 },
  { name: "Bekasi Barat", slug: "bekasi-barat", line: "Jabodebek", address: "Jl. Ir. H. Juanda, Bekasi", dailyPassengers: 36000, order: 16 },
  { name: "Padurenan", slug: "padurenan", line: "Jabodebek", address: "Jl. Padurenan, Bekasi", dailyPassengers: 17000, order: 17 },
  { name: "Jatiasih", slug: "jatiasih", line: "Jabodebek", address: "Jl. Raya Jatiasih, Bekasi", dailyPassengers: 20000, order: 18 },
];

const spaceTemplates: { type: SpaceType; name: string; area: number; rent: number }[] = [
  { type: "KIOS", name: "Kios", area: 12, rent: 8500000 },
  { type: "RUKO", name: "Ruko", area: 48, rent: 28000000 },
  { type: "ATM", name: "ATM Center", area: 4, rent: 5000000 },
  { type: "VENDING", name: "Vending Machine", area: 2, rent: 3000000 },
  { type: "MEDIA_IKLAN", name: "Media Iklan", area: 6, rent: 12000000 },
  { type: "AREA_PROMOSI", name: "Area Promosi", area: 20, rent: 15000000 },
];

const statusPattern: SpaceStatus[] = ["TERSEDIA", "TERSEDIA", "TERISI", "TERSEDIA", "TERISI", "MAINTENANCE"];

const DEMO_PANORAMAS = [
  "https://pannellum.org/images/alma.jpg",
  "https://pannellum.org/images/cerro-toco-0.jpg",
  "https://pannellum.org/images/jfk.jpg",
];

function getSpacePrefix(slug: string): string {
  return slug.toUpperCase().replace(/-/g, "").slice(0, 3);
}

function makeSceneData(slug: string, index: number) {
  const code = getSpacePrefix(slug);
  return [
    {
      sceneId: "concourse",
      title: "Concourse",
      panoramaUrl: DEMO_PANORAMAS[index % DEMO_PANORAMAS.length],
      order: 0,
      hotspots: [
        { pitch: -4, yaw: 118, type: "space", text: `Kios ${code}-01`, spaceCode: `${code}-01` },
        { pitch: -6, yaw: -58, type: "space", text: `Ruko ${code}-02`, spaceCode: `${code}-02` },
        { pitch: -2, yaw: 28, type: "scene", text: "Ke Gate Area", sceneId: "gate-area" },
      ],
    },
    {
      sceneId: "gate-area",
      title: "Gate Area",
      panoramaUrl: DEMO_PANORAMAS[(index + 1) % DEMO_PANORAMAS.length],
      order: 1,
      hotspots: [
        { pitch: -3, yaw: 88, type: "space", text: `ATM ${code}-03`, spaceCode: `${code}-03` },
        { pitch: -5, yaw: -112, type: "space", text: `Vending ${code}-04`, spaceCode: `${code}-04` },
        { pitch: -1, yaw: -30, type: "scene", text: "Kembali ke Concourse", sceneId: "concourse" },
        { pitch: 0, yaw: 142, type: "scene", text: "Ke Platform", sceneId: "platform" },
      ],
    },
    {
      sceneId: "platform",
      title: "Platform",
      panoramaUrl: DEMO_PANORAMAS[(index + 2) % DEMO_PANORAMAS.length],
      order: 2,
      hotspots: [
        { pitch: -4, yaw: 45, type: "space", text: `Media Iklan ${code}-05`, spaceCode: `${code}-05` },
        { pitch: -3, yaw: -80, type: "space", text: `Area Promosi ${code}-06`, spaceCode: `${code}-06` },
        { pitch: 0, yaw: 165, type: "scene", text: "Turun ke Gate Area", sceneId: "gate-area" },
      ],
    },
  ];
}

async function main() {
  console.log("Seeding database...");

  await prisma.visitEvent.deleteMany();
  await prisma.tenantLead.deleteMany();
  await prisma.virtualTourScene.deleteMany();
  await prisma.commercialSpace.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@lrtjabodebek.id",
      name: "Administrator",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("  ok Admin user (admin@lrtjabodebek.id / admin123)");

  for (const stationData of stations) {
    const station = await prisma.station.create({
      data: {
        ...stationData,
        description: `Stasiun ${stationData.name} merupakan bagian dari jaringan LRT Jabodebek yang melayani kawasan strategis di ${stationData.address.split(",").slice(-1)[0].trim()}.`,
      },
    });

    const prefix = stationData.slug.toUpperCase().replace(/-/g, "").slice(0, 3);

    for (let i = 0; i < spaceTemplates.length; i++) {
      const tmpl = spaceTemplates[i];

      await prisma.commercialSpace.create({
        data: {
          stationId: station.id,
          code: `${prefix}-${String(i + 1).padStart(2, "0")}`,
          name: `${tmpl.name} ${i + 1}`,
          type: tmpl.type,
          status: statusPattern[i],
          area: tmpl.area + ((i % 3) * 2),
          monthlyRent: tmpl.rent + (stationData.order % 5) * 350000 + i * 250000,
          deposit: tmpl.rent * 3,
          floor: i < 2 ? "G" : "1",
          location: i % 2 === 0 ? "Concourse Utama" : "Gate Area",
          nearestExit: `Exit ${String.fromCharCode(65 + (i % 4))}`,
          exposure: Math.round(stationData.dailyPassengers * (0.34 + i * 0.055)),
          powerSupply: "220V/10A",
          waterAccess: tmpl.type === "RUKO" || tmpl.type === "KIOS",
          airConditioning: true,
          description: `Unit komersial ${tmpl.name.toLowerCase()} di ${i % 2 === 0 ? "area concourse utama" : "gate area"} Stasiun ${stationData.name}, cocok untuk tenant yang membutuhkan eksposur penumpang tinggi.`,
        },
      });
    }

    for (const scene of makeSceneData(stationData.slug, stationData.order - 1)) {
      await prisma.virtualTourScene.create({
        data: {
          stationId: station.id,
          sceneId: scene.sceneId,
          title: scene.title,
          panoramaUrl: scene.panoramaUrl,
          order: scene.order,
          hotspots: scene.hotspots,
        },
      });
    }

    console.log(`  ok ${stationData.name} (${spaceTemplates.length} unit, 3 scenes)`);
  }

  console.log(`\nok Seeding selesai: ${stations.length} stasiun berhasil ditambahkan.`);
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
