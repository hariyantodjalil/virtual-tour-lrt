import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPanoramaTiles, PANO_CUBE, PANO_MAX_LEVEL, PANO_TILE } from "../lib/panorama-multires";
import sharp from "sharp";

const root = path.resolve("public/multires-demo");
const sources = [
  {
    id: "konkurs",
    title: "Konkurs",
    file: "E:/IIA 2026/Project Virtual Tour TOD 2026/panorama stasiun/bek/Concourse/Unpaid/Done/IMG_20260628_161749_00_001.jpg",
    next: "peron",
    nextTitle: "Ke peron",
  },
  {
    id: "peron",
    title: "Peron",
    file: "E:/IIA 2026/Project Virtual Tour TOD 2026/panorama stasiun/bek/Peron/IMG_20260628_164405_00_018.jpg",
    next: "konkurs",
    nextTitle: "Ke konkurs",
  },
];

async function writeScene(id: string, file: string) {
  const started = Date.now();
  const input = await sharp(file).rotate().toBuffer();
  const tiles = await buildPanoramaTiles(input);
  const dir = path.join(root, id);
  await Promise.all(
    tiles.map(async (tile) => {
      const target = path.join(dir, tile.name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, tile.buffer);
    })
  );
  const bytes = tiles.reduce((sum, tile) => sum + tile.buffer.length, 0);
  console.log(`${id}: ${tiles.length} tile, ${(bytes / 1024 / 1024).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(1)} dtk`);
}

const scenes = sources
  .map(
    (scene) => `    ${scene.id}: {
      title: ${JSON.stringify(scene.title)},
      type: "multires",
      multiRes: {
        basePath: "./${scene.id}",
        path: "/%l/%s%y_%x",
        extension: "jpg",
        tileResolution: ${PANO_TILE},
        maxLevel: ${PANO_MAX_LEVEL},
        cubeResolution: ${PANO_CUBE}
      },
      hotSpots: [{ pitch: -2, yaw: 55, type: "scene", text: ${JSON.stringify(scene.nextTitle)}, sceneId: ${JSON.stringify(scene.next)} }]
    }`
  )
  .join(",\n");

const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Uji tile Bekasi</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.css">
  <style>html,body{margin:0;height:100%}#panorama{height:100vh}</style>
</head>
<body>
  <div id="panorama"></div>
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.js"></script>
  <script>
    pannellum.viewer("panorama", {
      default: { firstScene: "konkurs", sceneFadeDuration: 300, autoLoad: true, hfov: 100 },
      scenes: {
${scenes}
      }
    });
  </script>
</body>
</html>
`;

async function main() {
  await mkdir(root, { recursive: true });
  for (const scene of sources) await writeScene(scene.id, scene.file);
  await writeFile(path.join(root, "index.html"), html);
  console.log(path.join(root, "index.html"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
