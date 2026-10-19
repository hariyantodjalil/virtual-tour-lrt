import { prisma } from "@/lib/prisma";

export interface MaintenanceConfig {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  "Situs Virtual Tour LRT Jabodebek sedang dalam pemeliharaan sistem. Silakan kembali beberapa saat lagi.";

// Fast in-memory state untuk pengecekan instan (0ms) di Middleware Next.js
let cachedConfig: MaintenanceConfig = {
  isMaintenanceMode: false,
  maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
  updatedBy: null,
  updatedAt: null,
};

let lastFetchTime = 0;
let isFetching = false;
const REFRESH_INTERVAL_MS = 10_000; // Refresh background setiap 10 detik

/**
 * Pengecekan instan synchronous (0ms) untuk Middleware / proxy.ts.
 * Menghindari middleware menggantung (hang) jika database lambat atau socket timeout.
 */
export function isMaintenanceActiveFast(): boolean {
  // Trigger background refresh jika cache sudah expired tanpa memblokir request
  const now = Date.now();
  if (now - lastFetchTime > REFRESH_INTERVAL_MS && !isFetching) {
    void refreshConfigInBackground();
  }
  return cachedConfig.isMaintenanceMode;
}

async function refreshConfigInBackground() {
  isFetching = true;
  try {
    const fetchPromise = prisma.systemSetting.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        isMaintenanceMode: false,
        maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 1500)
    );

    const setting = await Promise.race([fetchPromise, timeoutPromise]);
    cachedConfig = {
      isMaintenanceMode: setting.isMaintenanceMode,
      maintenanceMessage: setting.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    };
  } catch {
    // Abaikan error di background agar tidak mengganggu request
  } finally {
    lastFetchTime = Date.now();
    isFetching = false;
  }
}

export async function getMaintenanceConfig(forceFresh = false): Promise<MaintenanceConfig> {
  const now = Date.now();
  if (!forceFresh && now - lastFetchTime < REFRESH_INTERVAL_MS) {
    return cachedConfig;
  }

  try {
    const fetchPromise = prisma.systemSetting.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        isMaintenanceMode: false,
        maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DB timeout")), 1500)
    );

    const setting = await Promise.race([fetchPromise, timeoutPromise]);

    cachedConfig = {
      isMaintenanceMode: setting.isMaintenanceMode,
      maintenanceMessage: setting.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    };
    lastFetchTime = now;
  } catch (err) {
    console.warn("[Maintenance] Fallback ke cache saat koneksi DB lambat/timeout:", err);
    lastFetchTime = now;
  }

  return cachedConfig;
}

export async function updateMaintenanceConfig(params: {
  isMaintenanceMode: boolean;
  maintenanceMessage?: string;
  updatedBy?: string;
}): Promise<MaintenanceConfig> {
  const message = params.maintenanceMessage?.trim() || DEFAULT_MAINTENANCE_MESSAGE;

  const updated = await prisma.systemSetting.upsert({
    where: { id: "default" },
    update: {
      isMaintenanceMode: params.isMaintenanceMode,
      maintenanceMessage: message,
      updatedBy: params.updatedBy ?? null,
    },
    create: {
      id: "default",
      isMaintenanceMode: params.isMaintenanceMode,
      maintenanceMessage: message,
      updatedBy: params.updatedBy ?? null,
    },
  });

  cachedConfig = {
    isMaintenanceMode: updated.isMaintenanceMode,
    maintenanceMessage: updated.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
    updatedBy: updated.updatedBy,
    updatedAt: updated.updatedAt,
  };
  lastFetchTime = Date.now();

  return cachedConfig;
}
