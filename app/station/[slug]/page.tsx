import { after } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePrimaryUnitHotspot } from "@/lib/primary-unit-hotspot";
import { getCmsSessionUser } from "@/lib/cms-session";
import { concourseAssetCode, concourseLayout, concourseSlot } from "@/lib/concourse-plan";
import { resolveStationMinimap, type StationMinimapData } from "@/lib/station-minimap";
import { parseStationFloorplanData, layersFromCatalog, emptyFloorplanData } from "@/lib/station-floorplan";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { getStationBySlug, getStationMetaBySlug } from "@/lib/stations-data";
import { getPickerStations } from "@/lib/station-picker-data";
import StationTourClient from "./StationTourClient";
import TourLanguageProvider from "@/components/tour/TourLanguageProvider";
import { translateTourMessage } from "@/lib/tour-language";
import { getTourLanguage, getTourLanguageData } from "@/lib/tour-translated-content";

// Selalu render fresh dari DB — tidak pakai static generation
// agar perubahan data di CMS langsung terlihat di halaman publik
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [station, language] = await Promise.all([getStationMetaBySlug(slug), getTourLanguage()]);
  if (!station) return { title: translateTourMessage(language, "Stasiun Tidak Ditemukan") };
  return {
    title: translateTourMessage(language, "Virtual Tour {name} - LRT Jabodebek", { name: station.name }),
    description: translateTourMessage(language, "Eksplorasi ruang komersial Stasiun {name} LRT Jabodebek secara virtual 360°.", { name: station.name }),
  };
}

async function getStationData(slug: string) {
  try {
    return await prisma.station.findFirst({
      where: { slug, isActive: true },
      include: {
        concourseSlots: true,
        floorplan: { select: { data: true, isActive: true } },
        virtualTourLevels: {
          where: { isActive: true },
          select: { id: true, slug: true, label: true, minimap: true },
        },
        commercialSpaces: {
          orderBy: [{ floor: "asc" }, { code: "asc" }],
          include: {
            occupancy: {
              include: {
                tenant: { select: { brandName: true, logoUrl: true, isActive: true } },
              },
            },
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export default async function StationPage({ params }: Props) {
  const { slug } = await params;
  const [stationInfo, stationData, pickerStations, session, languageData] = await Promise.all([
    getStationBySlug(slug),
    getStationData(slug),
    getPickerStations(),
    getCmsSessionUser(),
    getTourLanguageData(),
  ]);

  if (!stationInfo || stationInfo.scenes.length === 0) notFound();

  if (stationData) {
    const stationId = stationData.id;
    after(() => {
      void prisma.visitEvent
        .create({
          data: {
            stationId,
            eventType: "STATION_VIEW",
          },
        })
        .catch(() => null);
    });
  }

  const spaces = stationData?.commercialSpaces ?? [];
  const floorplan = stationData?.floorplan;
  const parsedFloorplan = floorplan?.isActive
    ? parseStationFloorplanData(floorplan.data)
    : { ...emptyFloorplanData(), floorPlans: floorplan ? [] : layersFromCatalog(slug) };
  const floorplanData = {
    ...parsedFloorplan,
    floorPlans: parsedFloorplan.floorPlans.map((layer) => ({
      ...layer,
      url: getS3ProxyUrl(layer.url.startsWith("/") ? layer.url : `/${layer.sourceKey}`),
    })),
  };
  const minimaps: Record<string, StationMinimapData> = {};
  for (const level of stationData?.virtualTourLevels ?? []) {
    const minimap = resolveStationMinimap(slug, level, floorplanData.floorPlans);
    if (minimap) minimaps[level.id] = minimap;
  }
  const editorHref = stationData && (session?.role === "ADMIN" || session?.role === "EDITOR")
    ? `/cms/virtual-tour/${encodeURIComponent(stationData.id)}`
    : undefined;
  const layout = concourseLayout(stationData?.concourseLayout ?? null);
  const prefix = stationData?.assetCodePrefix ?? stationData?.code ?? "";
  const slots = prefix && layout ? (stationData?.concourseSlots ?? []).map(concourseSlot) : [];
  const assetCodes = new Map(slots.flatMap(slot => slot.spaceId ? [[slot.spaceId, concourseAssetCode(prefix, slot)] as const] : []));

  return (
    <div className="relative h-dvh overflow-hidden bg-[#1C0A0E]">
      <Suspense fallback={<div className="h-full bg-[#1C0A0E]" />}>
        <TourLanguageProvider {...languageData}>
        <StationTourClient
          stationInfo={stationInfo}
          pickerStations={pickerStations}
          editorHref={editorHref}
          minimaps={minimaps}
          concourse={{ layout, prefix, slots }}
          floorplan={floorplanData}
          spaces={spaces.map((s) => ({
            id: s.id,
            code: s.code,
            assetCode: assetCodes.get(s.id),
            primaryHotspot: parsePrimaryUnitHotspot(s.primaryHotspot),
            name: s.name,
            displayName: s.status === "TERISI"
              ? stationInfo.scenes.flatMap(scene => scene.hotspots).find(hotspot =>
                  hotspot.type === "space" && hotspot.spaceCode === s.code &&
                  hotspot.text?.trim() && !/^(unit|retail|space|scene|hotspot)\b/i.test(hotspot.text.trim())
                )?.text?.trim() || s.name
              : s.name,
            type: s.type,
            status: s.status as SpaceAvailabilityStatus,
            area: s.area,
            monthlyRent: s.monthlyRent,
            deposit: s.deposit,
            floor: s.floor,
            location: s.location,
            nearestExit: s.nearestExit,
            nearbyFacilities: Array.isArray(s.nearbyFacilities) ? s.nearbyFacilities : [],
            exposure: s.exposure,
            powerSupply: s.powerSupply,
            preferredUses: Array.isArray(s.preferredUses) ? s.preferredUses : [],
            waterAccess: s.waterAccess,
            airConditioning: s.airConditioning,
            description: s.description,
            panoramaUrl: s.panoramaUrl,
            tenantLogoUrl: s.occupancy?.tenant?.isActive ? s.occupancy.tenant.logoUrl : null,
            tenantBrand:
              s.occupancy?.tenant?.isActive !== false
                ? s.occupancy?.tenant?.brandName ?? null
                : null,
          }))}
        />
        </TourLanguageProvider>
      </Suspense>
    </div>
  );
}
