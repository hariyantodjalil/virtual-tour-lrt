import { z } from "zod";
import { validateSphericalPolygon } from "./geometry/polygon-validation";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const sphericalPointSchema = z.object({
  yaw: z.number().finite().min(-180).max(180),
  pitch: z.number().finite().min(-89.9).max(89.9),
});

const styleSchema = z
  .object({
    fillColor: hexColor.optional(),
    fillOpacity: z.number().min(0).max(1).optional(),
    strokeColor: hexColor.optional(),
    strokeOpacity: z.number().min(0).max(1).optional(),
    strokeWidthPx: z.number().min(0.5).max(12).optional(),
    hoverFillOpacity: z.number().min(0).max(1).optional(),
    showLabel: z.boolean().optional(),
    labelText: z.string().max(120).optional(),
    outlineOnly: z.boolean().optional(),
    badgeLetter: z.string().trim().max(2).optional(),
    showBoundaryHint: z.boolean().optional(),
  })
  .strict();

const spatialAreaGeometrySchema = z
  .object({
    type: z.literal("spherical_polygon"),
    vertices: z.array(sphericalPointSchema).min(3).max(64),
  })
  .strict()
  .superRefine((geom, ctx) => {
    const result = validateSphericalPolygon(geom.vertices);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.reason });
    }
  });

export const spatialEntitySchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    kind: z.literal("SPATIAL_AREA"),
    sceneId: z.string().trim().min(1).max(128),
    unitId: z.string().trim().min(1).max(64).nullable().optional(),
    spaceCode: z.string().trim().min(1).max(64).nullable().optional(),
    label: z.string().max(160).optional(),
    geometry: spatialAreaGeometrySchema,
    style: styleSchema.default({}),
    action: z
      .object({
        type: z.enum(["none", "unit_detail", "info_detail", "open_scene"]),
        targetId: z.string().trim().max(128).nullable().optional(),
        title: z.string().trim().max(160).optional(),
        description: z.string().trim().max(2000).optional(),
      })
      .strict()
      .superRefine((action, ctx) => {
        if (action.type === "info_detail" && !action.title) ctx.addIssue({ code: "custom", message: "Judul informasi area diperlukan." });
        if (action.type === "open_scene" && !action.targetId) ctx.addIssue({ code: "custom", message: "Target scene area diperlukan." });
      }),
    mediaAssetId: z.null().optional(),
    enabled: z.boolean(),
    zIndex: z.number().int().min(0).max(100).optional(),
    schemaVersion: z.literal(1),
    revision: z.number().int().min(1).max(1_000_000),
  })
  .strict();

export const spatialEntitiesSchema = z.array(spatialEntitySchema).max(100);
