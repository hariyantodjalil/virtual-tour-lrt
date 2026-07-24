/** Pengaturan interaksi Pannellum — lebih rendah = kurang sensitif di layar sentuh. */
export const PANNELLUM_INTERACTION = {
  /** Default Pannellum: 1. ~0.4 mengurangi kecepatan geser sentuh ~60%. */
  touchPanSpeedCoeffFactor: 0.4,
  /** Default Pannellum: 0.15. Lebih tinggi = momentum setelah lepas jari lebih cepat berhenti. */
  friction: 0.28,
} as const;

/** Batas pitch supaya masih bisa lihat sedikit atas/bawah tanpa sampai area ekstrem. */
export const PANNELLUM_PITCH_LIMITS = {
  minPitch: -58,
  maxPitch: 58,
} as const;

/**
 * HFOV — angka lebih besar = lebih zoom out.
 * Default = maxHfov agar mulai dari tampilan paling lebar; user zoom in dari situ.
 */
export const PANNELLUM_HFOV = {
  hfov: 120,
  minHfov: 50,
  maxHfov: 120,
} as const;

/** Editor boleh zoom in lebih dekat. */
export const PANNELLUM_EDITOR_HFOV = {
  hfov: 120,
  minHfov: 40,
  maxHfov: 120,
} as const;
