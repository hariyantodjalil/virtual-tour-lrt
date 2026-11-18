export type AiPatchRecord = {
  prompt: string;
  yaw: number;
  pitch: number;
  hfov: number;
  patchWidth: number;
  patchHeight: number;
  requestId?: string;
  model: string;
  createdAt: string;
};

function canvasDataBase(canvasData: unknown): Record<string, unknown> {
  return canvasData && typeof canvasData === "object" && !Array.isArray(canvasData)
    ? { ...(canvasData as Record<string, unknown>) }
    : {};
}

/** Master sebelum patch AI pertama — untuk restore. */
export function getAiPatchSourcePanoramaUrl(canvasData: unknown): string | null {
  const url = canvasDataBase(canvasData).aiPatchSourcePanoramaUrl;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export function getAiPatchHistory(canvasData: unknown): AiPatchRecord[] {
  const raw = canvasDataBase(canvasData).aiPatchHistory;
  if (!Array.isArray(raw)) return [];
  const out: AiPatchRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const prompt = typeof r.prompt === "string" ? r.prompt : "";
    if (!prompt) continue;
    out.push({
      prompt,
      yaw: Number(r.yaw ?? 0),
      pitch: Number(r.pitch ?? 0),
      hfov: Number(r.hfov ?? 100),
      patchWidth: Number(r.patchWidth ?? 0),
      patchHeight: Number(r.patchHeight ?? 0),
      requestId: typeof r.requestId === "string" ? r.requestId : undefined,
      model: typeof r.model === "string" ? r.model : "fal-ai/flux-pro/kontext",
      createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
    });
  }
  return out;
}

export function isAiPatchApplied(canvasData: unknown): boolean {
  return Boolean(canvasDataBase(canvasData).aiPatchLastBakedAt);
}

function privacyVersion(canvasData: unknown) {
  const base = canvasDataBase(canvasData);
  return {
    bakedAt: typeof base.privacyBlurLastBakedAt === "string" ? base.privacyBlurLastBakedAt : null,
    source: typeof base.privacyBlurSourcePanoramaUrl === "string" ? base.privacyBlurSourcePanoramaUrl : null,
  };
}

/** Restore must not remove privacy pixels baked after the saved pre-AI image. */
export function canRestoreAiPatch(canvasData: unknown): boolean {
  const base = canvasDataBase(canvasData);
  const current = privacyVersion(base);
  const snapshot = base.aiPatchPrivacySnapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const saved = snapshot as Record<string, unknown>;
    return saved.bakedAt === current.bakedAt && saved.source === current.source;
  }
  // Legacy histories have no reliable first-patch snapshot; fail closed when blurred.
  return !current.bakedAt;
}

export function markAiPatchBaked(
  canvasData: unknown,
  sourcePanoramaUrl: string,
  record: AiPatchRecord
): Record<string, unknown> {
  const history = getAiPatchHistory(canvasData);
  return {
    ...canvasDataBase(canvasData),
    ...(!getAiPatchSourcePanoramaUrl(canvasData) && !isAiPatchApplied(canvasData)
      ? { aiPatchPrivacySnapshot: privacyVersion(canvasData) } : {}),
    aiPatchSourcePanoramaUrl: sourcePanoramaUrl,
    aiPatchLastBakedAt: record.createdAt,
    aiPatchLastPrompt: record.prompt,
    aiPatchLastView: {
      yaw: record.yaw,
      pitch: record.pitch,
      hfov: record.hfov,
    },
    aiPatchHistory: [...history, record].slice(-20),
  };
}

export function clearAiPatchMetadata(canvasData: unknown): Record<string, unknown> {
  const base = canvasDataBase(canvasData);
  delete base.aiPatchLastBakedAt;
  delete base.aiPatchLastPrompt;
  delete base.aiPatchLastView;
  delete base.aiPatchHistory;
  delete base.aiPatchSourcePanoramaUrl;
  delete base.aiPatchRestoredAt;
  delete base.aiPatchPrivacySnapshot;
  return base;
}

export function markAiPatchRestored(canvasData: unknown): Record<string, unknown> {
  const base = clearAiPatchMetadata(canvasData);
  return {
    ...base,
    aiPatchRestoredAt: new Date().toISOString(),
  };
}

/** Setelah ganti file panorama fisik — reset jejak AI. */
export function resetAiPatchForNewPanorama(canvasData: unknown): Record<string, unknown> {
  return clearAiPatchMetadata(canvasData);
}
