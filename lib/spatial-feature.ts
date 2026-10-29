/**
 * Feature flag Spatial Area Hotspot (Editor V2).
 * Client: NEXT_PUBLIC_CMS_SPATIAL_HOTSPOT=1
 * Server: CMS_SPATIAL_HOTSPOT=1 (also accepts public var)
 */
export function isSpatialHotspotEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_CMS_SPATIAL_HOTSPOT;
  const srv = process.env.CMS_SPATIAL_HOTSPOT;
  const raw = typeof window === "undefined" ? (srv ?? pub ?? "") : (pub ?? "");
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on";
}
