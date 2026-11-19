import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3, deleteFromS3 } from "@/lib/s3";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import {
  emptyFloorplanData,
  floorPlanLayerSchema,
  layersFromCatalog,
  layerViewBox,
  newPlacedAssetId,
  parseStationFloorplanData,
  slugifyFloorName,
  stationFloorplanDataSchema,
  validatePlacedAssetRefs,
  type FloorPlanLayer,
  type StationFloorplanData,
} from "@/lib/station-floorplan";

type Context = { params: Promise<{ stationId: string }> };

const putSchema = stationFloorplanDataSchema;
const deleteLayerSchema = z.object({
  layerId: z.string().trim().min(1).max(128),
  deleteObject: z.literal(false).optional(),
}).strict();

function withProxyUrls(data: StationFloorplanData): StationFloorplanData {
  return {
    ...data,
    floorPlans: data.floorPlans.map((layer) => ({
      ...layer,
      url: getS3ProxyUrl(layer.url.startsWith("/") ? layer.url : `/${layer.sourceKey}`),
    })),
  };
}

function persistableData(data: StationFloorplanData): StationFloorplanData {
  return {
    ...data,
    floorPlans: data.floorPlans.map((layer) => {
      const sourceKey = layer.sourceKey
        .replace(/^\/api\/s3-proxy\//, "")
        .replace(/^\//, "");
      return {
        ...layer,
        sourceKey,
        url: `/${sourceKey}`,
      };
    }),
  };
}

async function loadStation(stationId: string) {
  return prisma.station.findUnique({
    where: { id: stationId },
    select: {
      id: true,
      slug: true,
      name: true,
      code: true,
      assetCodePrefix: true,
      concourseLayout: true,
      floorplan: { select: { id: true, data: true, isActive: true, updatedAt: true } },
      concourseSlots: {
        select: {
          id: true, spaceId: true, access: true, kind: true, sequence: true,
          section: true, row: true, position: true,
        },
      },
      commercialSpaces: {
        select: {
          id: true, code: true, name: true, status: true, type: true, floor: true,
          occupancy: { select: { tenant: { select: { brandName: true, logoUrl: true, isActive: true } } } },
        },
        orderBy: [{ floor: "asc" }, { code: "asc" }],
      },
      virtualTourScenes: { select: { sceneId: true, title: true, levelId: true }, orderBy: { order: "asc" } },
      virtualTourLevels: { select: { id: true, slug: true, label: true }, where: { isActive: true }, orderBy: { order: "asc" } },
    },
  });
}

function ensureData(station: NonNullable<Awaited<ReturnType<typeof loadStation>>>): StationFloorplanData {
  if (station.floorplan) return parseStationFloorplanData(station.floorplan.data);
  return { ...emptyFloorplanData(), floorPlans: layersFromCatalog(station.slug) };
}

function conflict() {
  return NextResponse.json({ error: "Denah sudah diperbarui di sesi lain. Buka ulang editor sebelum menyimpan." }, { status: 409 });
}

function matchesRevision(request: NextRequest, updatedAt: Date | null) {
  const revision = request.headers.get("if-match");
  return revision === null || revision === JSON.stringify(updatedAt?.toISOString() ?? "new");
}

async function persist(stationId: string, data: StationFloorplanData, revision: Date | null) {
  return prisma.$transaction(async tx => {
    const result = revision
      ? await tx.stationFloorplan.updateMany({ where: { stationId, updatedAt: revision }, data: { data, isActive: true } })
      : await tx.stationFloorplan.createMany({ data: [{ stationId, data }], skipDuplicates: true });
    if (result.count !== 1) return null;
    return tx.stationFloorplan.findUnique({ where: { stationId }, select: { id: true, data: true, updatedAt: true } });
  });
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const station = await loadStation(stationId);
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan." }, { status: 404 });

  const data = ensureData(station);
  return NextResponse.json({
    station: {
      id: station.id,
      slug: station.slug,
      name: station.name,
      code: station.code,
      assetCodePrefix: station.assetCodePrefix,
      concourseLayout: station.concourseLayout,
    },
    data: withProxyUrls(data),
    updatedAt: station.floorplan?.updatedAt ?? null,
    palette: {
      spaces: station.commercialSpaces.map((space) => ({
        id: space.id,
        code: space.code,
        name: space.name,
        status: space.status,
        type: space.type,
        floor: space.floor,
        tenantBrand: space.occupancy?.tenant?.isActive !== false
          ? space.occupancy?.tenant?.brandName ?? null
          : null,
        tenantLogoUrl: space.occupancy?.tenant?.isActive !== false
          ? space.occupancy?.tenant?.logoUrl ?? null
          : null,
      })),
      slots: station.concourseSlots,
      scenes: station.virtualTourScenes,
      levels: station.virtualTourLevels,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, putSchema, 2_000_000);
  if (!parsed.success) return parsed.response;

  const { stationId } = await params;
  const station = await loadStation(stationId);
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan." }, { status: 404 });

  const revision = station.floorplan?.updatedAt ?? null;
  if (!matchesRevision(request, revision)) return conflict();
  const existingLayers = ensureData(station).floorPlans;
  if (parsed.data.floorPlans.length !== existingLayers.length || parsed.data.floorPlans.some(layer =>
    !existingLayers.some(current => current.id === layer.id && current.sourceKey === layer.sourceKey))) {
    return NextResponse.json({ error: "Layer denah hanya dapat ditambah melalui upload atau dihapus melalui Kelola denah." }, { status: 400 });
  }
  const data = persistableData({ ...parsed.data, floorPlans: existingLayers });
  const refError = validatePlacedAssetRefs(data, {
    spaceIds: new Set(station.commercialSpaces.map((space) => space.id)),
    slotIds: new Set(station.concourseSlots.map((slot) => slot.id)),
    slotSpaceIds: new Map(station.concourseSlots.map(slot => [slot.id, slot.spaceId])),
    sceneIds: new Set(station.virtualTourScenes.map((scene) => scene.sceneId)),
  });
  if (refError) return NextResponse.json({ error: refError }, { status: 400 });

  const saved = await persist(stationId, data, revision);
  if (!saved) return conflict();

  return NextResponse.json({
    ok: true,
    id: saved.id,
    updatedAt: saved.updatedAt,
    data: withProxyUrls(parseStationFloorplanData(saved.data)),
  });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const station = await loadStation(stationId);
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan." }, { status: 404 });

  const revision = station.floorplan?.updatedAt ?? null;
  if (!matchesRevision(request, revision)) return conflict();
  const current = ensureData(station);
  if (current.floorPlans.length >= 24) return NextResponse.json({ error: "Maksimal 24 layer denah per stasiun." }, { status: 400 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form upload denah tidak valid." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "File denah wajib diunggah." }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "File denah terlalu besar (maks 12MB)." }, { status: 413 });
  }

  const name = String(formData.get("name") || "Concourse").trim().slice(0, 80) || "Concourse";
  const levelIdRaw = String(formData.get("levelId") || "").trim();
  if (levelIdRaw && !station.virtualTourLevels.some(level => level.id === levelIdRaw)) {
    return NextResponse.json({ error: "Lantai tidak terdaftar untuk stasiun ini." }, { status: 400 });
  }
  const levelId = levelIdRaw || undefined;
  let buffer: Buffer;
  let width: number;
  let height: number;
  let format: string;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!["webp", "png", "jpeg", "svg"].includes(metadata.format ?? "") || !metadata.width || !metadata.height || metadata.width > 20000 || metadata.height > 20000 || metadata.width * metadata.height > 40_000_000) {
      throw Error("Invalid dimensions or format");
    }
    format = metadata.format === "svg" ? "webp" : metadata.format!;
    const output = await image.rotate().toFormat(format as "webp" | "png" | "jpeg").toBuffer({ resolveWithObject: true });
    buffer = output.data;
    ({ width, height } = output.info);
  } catch {
    return NextResponse.json({ error: "Gunakan gambar WEBP, PNG, JPG, atau SVG yang valid (maks. 40 megapiksel)." }, { status: 400 });
  }
  const key = generateS3Key("floorplans", `${slugifyFloorName(name)}.${format}`, { stationSlug: station.slug });
  const layer: FloorPlanLayer = floorPlanLayerSchema.parse({
    id: `floor-${Date.now()}-${newPlacedAssetId("space").slice(-6)}`,
    levelId,
    name,
    sourceKey: key,
    url: `/${key}`,
    viewBox: layerViewBox(width, height),
    width,
    height,
    isActive: true,
  });

  const next: StationFloorplanData = {
    ...current,
    floorPlans: [...current.floorPlans, layer],
  };

  try {
    await uploadToS3(buffer, key, `image/${format}`, { station: station.slug, level: name });
  } catch {
    return NextResponse.json({ error: "Penyimpanan denah tidak dapat diakses. Coba lagi saat jaringan tersedia." }, { status: 503 });
  }
  const saved = await persist(stationId, next, revision);
  if (!saved) {
    await deleteFromS3(key).catch(() => undefined);
    return conflict();
  }

  return NextResponse.json({
    ok: true,
    layer: { ...layer, url: getS3ProxyUrl(layer.url) },
    data: withProxyUrls(parseStationFloorplanData(saved.data)),
    updatedAt: saved.updatedAt,
  });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, deleteLayerSchema, 4096);
  if (!parsed.success) return parsed.response;

  const { stationId } = await params;
  const station = await loadStation(stationId);
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan." }, { status: 404 });

  const current = ensureData(station);
  const layer = current.floorPlans.find((item) => item.id === parsed.data.layerId);
  if (!layer) return NextResponse.json({ error: "Layer denah tidak ditemukan." }, { status: 404 });

  const revision = station.floorplan?.updatedAt ?? null;
  if (!matchesRevision(request, revision)) return conflict();

  const next: StationFloorplanData = {
    ...current,
    floorPlans: current.floorPlans.filter((item) => item.id !== layer.id),
    placedAssets: current.placedAssets.filter((asset) => asset.floorPlanId !== layer.id),
  };

  const saved = await persist(stationId, next, revision);
  if (!saved) return conflict();

  return NextResponse.json({
    ok: true,
    data: withProxyUrls(parseStationFloorplanData(saved.data)),
    updatedAt: saved.updatedAt,
  });
}
