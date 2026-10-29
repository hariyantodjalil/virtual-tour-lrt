/** Domain types Spatial Area Hotspot (Editor V2). Additive; pin hotspots tetap terpisah. */

export type SphericalPoint = {
  yaw: number;
  pitch: number;
};

export type Vec3 = { x: number; y: number; z: number };

export type ScreenPoint = { x: number; y: number };

export type CameraState = {
  yawDeg: number;
  pitchDeg: number;
  hfovDeg: number;
  widthCssPx: number;
  heightCssPx: number;
};

export type SpatialEntityKind = "SPATIAL_AREA" | "PERSPECTIVE_SURFACE";
export type SpatialActionKind = "none" | "unit_detail" | "info_detail" | "open_scene";

export type StyleConfig = {
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWidthPx?: number;
  hoverFillOpacity?: number;
  showLabel?: boolean;
  labelText?: string;
  /** Outline-first seperti boundary unit di foto referensi (fill hampir transparan). */
  outlineOnly?: boolean;
  /** Huruf di badge lingkaran (mis. "L"); kosong = huruf pertama label/spaceCode. */
  badgeLetter?: string;
  /** Tampilkan caption "Boundary Indicative*". */
  showBoundaryHint?: boolean;
};

export type SpatialAreaGeometry = {
  type: "spherical_polygon";
  vertices: SphericalPoint[];
};

export type PerspectiveSurfaceGeometry = {
  type: "spherical_quad";
  corners: [SphericalPoint, SphericalPoint, SphericalPoint, SphericalPoint];
  cornerOrder: "TL_TR_BR_BL";
};

export type SpatialEntity = {
  id: string;
  kind: SpatialEntityKind;
  sceneId: string;
  /** CommercialSpace.id — otoritatif untuk taut unit */
  unitId?: string | null;
  /** Parallel space code untuk coverage/public click (resolved dari master) */
  spaceCode?: string | null;
  label?: string;
  geometry: SpatialAreaGeometry | PerspectiveSurfaceGeometry;
  style: StyleConfig;
  action: { type: SpatialActionKind; targetId?: string | null; title?: string; description?: string };
  mediaAssetId?: string | null;
  enabled: boolean;
  zIndex?: number;
  schemaVersion: 1;
  revision: number;
};

export const SPATIAL_POC_POLYGON: SphericalPoint[] = [
  { yaw: -20, pitch: -5 },
  { yaw: 20, pitch: -5 },
  { yaw: 20, pitch: -18 },
  { yaw: -20, pitch: -18 },
];

/** Default: stroke neon, fill tipis, badge status+kode; hint boundary opt-in. */
export const DEFAULT_SPATIAL_STYLE: StyleConfig = {
  fillColor: "#22C55E",
  fillOpacity: 0.1,
  strokeColor: "#4ADE80",
  strokeOpacity: 1,
  strokeWidthPx: 2.5,
  hoverFillOpacity: 0.18,
  showLabel: true,
  outlineOnly: true,
  showBoundaryHint: false,
};
