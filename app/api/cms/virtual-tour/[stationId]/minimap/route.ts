import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";
import { minimapAssets, minimapPoint, parseMinimapConfig, resolveStationMinimap } from "@/lib/station-minimap";
import { parseStationFloorplanData } from "@/lib/station-floorplan";

type Context = { params: Promise<{ stationId: string }> };

const updateSchema = z.object({
  levelId: z.string().trim().min(1).max(128),
  sceneId: z.string().trim().min(1).max(160),
  sourceKey: z.string().trim().min(1).max(240),
  point: minimapPoint,
}).strict();

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { stationId } = await params;
  const levelId = request.nextUrl.searchParams.get("level");
  const sceneId = request.nextUrl.searchParams.get("scene");
  const level = levelId ? await prisma.virtualTourLevel.findFirst({
    where: { id: levelId, stationId },
    select: {
      id: true, slug: true, label: true, minimap: true,
      station: {
        select: {
          slug: true,
          floorplan: { select: { data: true, isActive: true } },
        },
      },
    },
  }) : null;
  if (!level) return NextResponse.json({ error: "Lantai tidak ditemukan." }, { status: 404 });
  const { floorplan } = level.station;
  const dbLayers = floorplan ? floorplan.isActive ? parseStationFloorplanData(floorplan.data).floorPlans : [] : undefined;
  const assets = minimapAssets(level.station.slug, dbLayers, levelId ?? undefined);
  const positions = parseMinimapConfig(level.minimap)?.positionsBySource ?? {};
  return NextResponse.json({
    assets,
    selectedSourceKey: resolveStationMinimap(level.station.slug, level, dbLayers)?.asset.sourceKey ?? null,
    pointBySource: Object.fromEntries(assets.map(asset => [
      asset.sourceKey, sceneId && Object.hasOwn(positions[asset.sourceKey] ?? {}, sceneId)
        ? positions[asset.sourceKey][sceneId] : null,
    ])),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, updateSchema, 8192);
  if (!parsed.success) return parsed.response;

  const { stationId } = await params;
  const { levelId, sceneId, sourceKey, point } = parsed.data;
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM virtual_tour_levels WHERE id = ${levelId} AND "stationId" = ${stationId} FOR UPDATE`;
    const level = await tx.virtualTourLevel.findFirst({
      where: { id: levelId, stationId },
      select: {
        minimap: true,
        station: {
          select: {
            slug: true,
            floorplan: { select: { data: true, isActive: true } },
          },
        },
        scenes: { where: { sceneId }, select: { id: true }, take: 1 },
      },
    });
    if (!level?.scenes.length) return "missing";
    const { floorplan } = level.station;
    const dbLayers = floorplan ? floorplan.isActive ? parseStationFloorplanData(floorplan.data).floorPlans : [] : undefined;
    if (!minimapAssets(level.station.slug, dbLayers, levelId ?? undefined).some(asset => asset.sourceKey === sourceKey)) return "invalid";

    const positionsBySource = parseMinimapConfig(level.minimap)?.positionsBySource ?? {};
    await tx.virtualTourLevel.update({
      where: { id: levelId },
      data: { minimap: {
        sourceKey,
        positionsBySource: {
          ...positionsBySource,
          [sourceKey]: { ...positionsBySource[sourceKey], [sceneId]: point },
        },
      } },
    });
    return "saved";
  });
  if (result === "missing") return NextResponse.json({ error: "Scene tidak ditemukan pada lantai ini." }, { status: 404 });
  if (result === "invalid") return NextResponse.json({ error: "Denah tidak terdaftar untuk stasiun ini." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
