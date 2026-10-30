import { PrismaClient, SpaceStatus, SpaceType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Daftar stasiun LRT Jabodebek — kode & urutan dari portal-lrt-db
type StationSeed = {
  name: string;
  nameId: string;
  slug: string;
  code: string;
  line: string;
  address: string;
  location: string;
  dailyPassengers: number;
  order: number;
  latitude: number;
  longitude: number;
};

const stations: StationSeed[] = [
  { name: "Dukuh Atas BNI", nameId: "Dukuh Atas BNI", slug: "dukuh-atas", code: "DKA", line: "Bekasi & Harjamukti", address: "Tanah Abang, Jakarta Pusat", location: "Jakarta Pusat", dailyPassengers: 45000, order: 1, latitude: -6.204828, longitude: 106.8255301 },
  { name: "Setiabudi", nameId: "Setiabudi", slug: "setiabudi", code: "SET", line: "Bekasi & Harjamukti", address: "Setia Budi, Jakarta Selatan", location: "Jakarta Selatan", dailyPassengers: 32000, order: 2, latitude: -6.2093184, longitude: 106.8302209 },
  { name: "Rasuna Said", nameId: "Rasuna Said", slug: "rasuna-said", code: "RAS", line: "Bekasi & Harjamukti", address: "Setia Budi, Jakarta Selatan", location: "Jakarta Selatan", dailyPassengers: 28000, order: 3, latitude: -6.2216089, longitude: 106.8322373 },
  { name: "Kuningan", nameId: "Kuningan", slug: "kuningan", code: "KUA", line: "Bekasi & Harjamukti", address: "Setia Budi, Jakarta Selatan", location: "Jakarta Selatan", dailyPassengers: 35000, order: 4, latitude: -6.2287727, longitude: 106.8332031 },
  { name: "Pancoran Bank BJB", nameId: "Pancoran Bank BJB", slug: "pancoran-bank-bjb", code: "PAN", line: "Bekasi & Harjamukti", address: "Pancoran, Jakarta Selatan", location: "Jakarta Selatan", dailyPassengers: 22000, order: 5, latitude: -6.2421415, longitude: 106.8385146 },
  { name: "Cikoko", nameId: "Cikoko", slug: "cikoko", code: "CIK", line: "Bekasi & Harjamukti", address: "Pancoran, Jakarta Selatan", location: "Jakarta Selatan", dailyPassengers: 18000, order: 6, latitude: -6.2434846, longitude: 106.8570718 },
  { name: "Ciliwung", nameId: "Ciliwung", slug: "ciliwung", code: "CIL", line: "Bekasi & Harjamukti", address: "Pancoran, Jakarta Selatan", location: "Jakarta Timur", dailyPassengers: 16000, order: 7, latitude: -6.2434448, longitude: 106.8639705 },
  { name: "Cawang", nameId: "Cawang", slug: "cawang", code: "CWG", line: "Bekasi & Harjamukti", address: "Jatinegara, Jakarta Timur", location: "Jakarta Timur", dailyPassengers: 38000, order: 8, latitude: -6.2459023, longitude: 106.8712426 },
  { name: "Halim", nameId: "Halim", slug: "halim", code: "HAL", line: "Bekasi", address: "Makasar, Jakarta Timur", location: "Jakarta Timur", dailyPassengers: 31000, order: 9, latitude: -6.2458656, longitude: 106.8872875 },
  { name: "Jatibening Baru", nameId: "Jatibening Baru", slug: "jatibening-baru", code: "JTU", line: "Bekasi", address: "Pondokgede, Kota Bekasi", location: "Kota Bekasi", dailyPassengers: 21000, order: 10, latitude: -6.2577476, longitude: 106.9279199 },
  { name: "Cikunir 1", nameId: "Cikunir 1", slug: "cikunir-1", code: "CK1", line: "Bekasi", address: "Pondokmelati, Kota Bekasi", location: "Kota Bekasi", dailyPassengers: 19000, order: 11, latitude: -6.2566001, longitude: 106.9518734 },
  { name: "Cikunir 2", nameId: "Cikunir 2", slug: "cikunir-2", code: "CK2", line: "Bekasi", address: "Pondokmelati, Kota Bekasi", location: "Kota Bekasi", dailyPassengers: 18500, order: 12, latitude: -6.2546849, longitude: 106.9632233 },
  { name: "Bekasi Barat", nameId: "Bekasi Barat", slug: "bekasi-barat", code: "BEK", line: "Bekasi", address: "Bekasi Barat, Kota Bekasi", location: "Kota Bekasi", dailyPassengers: 36000, order: 13, latitude: -6.2529489, longitude: 106.9904237 },
  { name: "Jatimulya", nameId: "Jatimulya", slug: "jatimulya", code: "JTM", line: "Bekasi", address: "Tambun Selatan, Kota Bekasi", location: "Kota Bekasi", dailyPassengers: 24000, order: 14, latitude: -6.2641077, longitude: 107.0216701 },
  { name: "TMII", nameId: "TMII", slug: "tmii", code: "TMI", line: "Harjamukti", address: "Pasar Rebo, Jakarta Timur", location: "Jakarta Timur", dailyPassengers: 25000, order: 15, latitude: -6.2928955, longitude: 106.8806355 },
  { name: "Kampung Rambutan", nameId: "Kampung Rambutan", slug: "kampung-rambutan", code: "KAM", line: "Harjamukti", address: "Pasar Rebo, Jakarta Timur", location: "Jakarta Timur", dailyPassengers: 42000, order: 16, latitude: -6.3095494, longitude: 106.8843804 },
  { name: "Ciracas", nameId: "Ciracas", slug: "ciracas", code: "CRC", line: "Harjamukti", address: "Cipayung, Jakarta Timur", location: "Jakarta Timur", dailyPassengers: 19000, order: 17, latitude: -6.3237795, longitude: 106.8867366 },
  { name: "Harjamukti", nameId: "Harjamukti", slug: "harjamukti", code: "HAR", line: "Harjamukti", address: "Cipayung, Depok", location: "Depok", dailyPassengers: 28000, order: 18, latitude: -6.3739095, longitude: 106.8956745 },
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

function getSpacePrefix(code: string): string {
  return code.toUpperCase();
}

function makeSceneData(stationCode: string, index: number) {
  const prefix = getSpacePrefix(stationCode);
  return [
    {
      sceneId: "concourse",
      title: "Concourse",
      level: "CONCOURSE",
      panoramaUrl: DEMO_PANORAMAS[index % DEMO_PANORAMAS.length],
      order: 0,
      hotspots: [
        { pitch: -4, yaw: 118, type: "space", text: `Kios ${prefix}-01`, spaceCode: `${prefix}-01` },
        { pitch: -6, yaw: -58, type: "space", text: `Ruko ${prefix}-02`, spaceCode: `${prefix}-02` },
        { pitch: -2, yaw: 28, type: "scene", text: "Ke Gate Area", sceneId: "gate-area" },
      ],
    },
    {
      sceneId: "gate-area",
      title: "Gate Area",
      level: "CONCOURSE",
      panoramaUrl: DEMO_PANORAMAS[(index + 1) % DEMO_PANORAMAS.length],
      order: 1,
      hotspots: [
        { pitch: -3, yaw: 88, type: "space", text: `ATM ${prefix}-03`, spaceCode: `${prefix}-03` },
        { pitch: -5, yaw: -112, type: "space", text: `Vending ${prefix}-04`, spaceCode: `${prefix}-04` },
        { pitch: -1, yaw: -30, type: "scene", text: "Kembali ke Concourse", sceneId: "concourse" },
        { pitch: 0, yaw: 142, type: "scene", text: "Ke Platform", sceneId: "platform" },
      ],
    },
    {
      sceneId: "platform",
      title: "Platform",
      level: "PLATFORM",
      panoramaUrl: DEMO_PANORAMAS[(index + 2) % DEMO_PANORAMAS.length],
      order: 2,
      hotspots: [
        { pitch: -4, yaw: 45, type: "space", text: `Media Iklan ${prefix}-05`, spaceCode: `${prefix}-05` },
        { pitch: -3, yaw: -80, type: "space", text: `Area Promosi ${prefix}-06`, spaceCode: `${prefix}-06` },
        { pitch: 0, yaw: 165, type: "scene", text: "Turun ke Gate Area", sceneId: "gate-area" },
      ],
    },
  ];
}

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Seed dibatalkan. Set ALLOW_DESTRUCTIVE_SEED=true untuk mengizinkan reset data.");
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Seed production dibatalkan. Set ALLOW_PRODUCTION_SEED=true jika benar-benar diperlukan.");
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPlainPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPlainPassword || adminPlainPassword.length < 12) {
    throw new Error("SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD (minimal 12 karakter) wajib diisi.");
  }

  console.log("Seeding database...");

  await prisma.visitEvent.deleteMany();
  await prisma.tenantLead.deleteMany();
  await prisma.virtualTourScene.deleteMany();
  await prisma.stationVirtualTour.deleteMany();
  await prisma.commercialSpace.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash(adminPlainPassword, 12);
  await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Administrator",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`  ok Admin user (${adminEmail})`);

  for (const stationData of stations) {
    const station = await prisma.station.create({
      data: {
        code: stationData.code,
        name: stationData.name,
        nameId: stationData.nameId,
        slug: stationData.slug,
        line: stationData.line,
        address: stationData.address,
        location: stationData.location,
        dailyPassengers: stationData.dailyPassengers,
        order: stationData.order,
        latitude: stationData.latitude,
        longitude: stationData.longitude,
        isActive: true,
        commercialContactPhone: null,
        description: `Stasiun ${stationData.name} merupakan bagian dari jaringan LRT Jabodebek yang melayani kawasan strategis di ${stationData.location}.`,
      },
    });

    const prefix = stationData.code;

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

    for (const scene of makeSceneData(stationData.code, stationData.order - 1)) {
      await prisma.virtualTourScene.create({
        data: {
          stationId: station.id,
          sceneId: scene.sceneId,
          title: scene.title,
          level: scene.level,
          panoramaUrl: scene.panoramaUrl,
          order: scene.order,
          hotspots: scene.hotspots,
          canvasData: { initialView: { yaw: 0, pitch: 0, hfov: 100 } },
        },
      });
    }

    // Konfigurasi agregat virtual tour — paralel station_floorplans di portal-lrt
    await prisma.stationVirtualTour.create({
      data: {
        stationId: station.id,
        data: {
          defaultSceneId: "concourse",
          editorSettings: { autoRotate: -2, defaultHfov: 100 },
        },
        isActive: true,
      },
    });

    console.log(`  ok ${stationData.name} [${stationData.code}] (${spaceTemplates.length} unit, 3 scenes)`);
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
