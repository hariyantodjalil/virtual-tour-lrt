---
name: Virtual Tour LRT Jabodebek
description: Void Portal maroon — homepage immersif dengan canvas maroon gelap LRT
colors:
  void: "#1C0A0E"
  concourse: "#261015"
  navy: "#1B3A6B"
  signal: "#E31E2D"
  led: "#FF6B4A"
  live: "#34d399"
  fog: "#C4A8AD"
  ink: "#F8ECEE"
  panel: "#3A161C"
  hairline: "rgba(255, 214, 218, 0.14)"
  shadow: "rgba(28, 10, 14, 0.55)"
  pattern: "#5C2A32"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Chakra Petch, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.75rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Chakra Petch, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Chakra Petch, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "24px"
  full: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "32px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.white}"
    textColor: "#000000"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  station-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "28px"
---

# Design System — Void Portal (Maroon)

## Overview

Homepage publik memakai bahasa **void immersif** dengan canvas **maroon gelap LRT** (`#1C0A0E`) — bukan hitam netral. Struktur Superdesign (reveal, parallax, noise) tetap; suhu warna digeser ke identitas signal merah `#E31E2D`. Tipografi Chakra Petch + Source Sans 3.

## Color strategy

- **Suhu:** hangat institusional rail (wine/maroon), bukan void dingin.
- **Dominan:** canvas maroon + panel `#3A161C`; aksen signal `#E31E2D` untuk CTA & kartu aksi.
- **Netral tertinta:** fog/hairline dari hue merah muda, bukan abu netral.
- **Jangan:** kembali ke `#050505` hitam; jangan ganti signal dengan oranye Superdesign.

## Layout

### Homepage
1. Hero full-bleed maroon + floating orbs + CTA pill
2. Mission statement (alur)
3. Dua kartu staggered (ketersediaan / tour)
4. Deck inventori
5. Footer kontak

### Station tour (`/station/[slug]`)
1. Panorama 360° full-bleed (Experience lead)
2. Chip stasiun + badge ketersediaan di atas (di bawah navbar)
3. Rail tool kanan: Info / Rute / Unit (hover label, active signal)
4. Panel terbang / drawer kanan maroon glass
5. Nav level → area → scene di bawah (pills)

## Elevation & Depth

Panel maroon elevated di atas void. Kartu signal glow merah saat hover. Wash radial signal/navy di `.home-void`. Tour chrome memakai `.tour-glass` / `.tour-glass-panel` + motion `tour-panel-in` / `tour-drawer-in`.

## Do's and Don'ts

**Do:** biarkan maroon terbaca sebagai brand LRT dari viewport pertama; chrome tour mengikuti dunia yang sama.  
**Don't:** hitam murni sebagai canvas; klaim palsu; Inter/Playfair/#FF4500; HUD navy generik (`#0d1f3c`) di tour publik.
