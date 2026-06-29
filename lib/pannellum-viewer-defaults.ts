/** Pengaturan interaksi Pannellum — lebih rendah = kurang sensitif di layar sentuh. */
export const PANNELLUM_INTERACTION = {
  /** Default Pannellum: 1. ~0.4 mengurangi kecepatan geser sentuh ~60%. */
  touchPanSpeedCoeffFactor: 0.4,
  /** Default Pannellum: 0.15. Lebih tinggi = momentum setelah lepas jari lebih cepat berhenti. */
  friction: 0.28,
} as const;
