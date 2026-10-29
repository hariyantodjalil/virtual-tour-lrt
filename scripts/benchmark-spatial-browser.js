// Run with playwright-cli run-code --filename scripts/benchmark-spatial-browser.js.
// Requires the isolated fixture from prepare-spatial-browser.mts and a logged-in
// browser on 127.0.0.1:3100. Intercepts fixture GET responses; never writes areas.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI invokes this function expression.
async (page) => {
  const origin = "http://127.0.0.1:3100";
  if (!page.url().startsWith(`${origin}/cms/virtual-tour/spatial-browser-station`)) throw new Error("Local fixture required");
  // Discard only local, unsaved fixture edits left by the interaction check.
  const discardFixtureEdits = async (dialog) => {
    if (dialog.type() !== "beforeunload") throw new Error(`Unexpected dialog: ${dialog.type()}`);
    await dialog.accept();
  };
  page.on("dialog", discardFixtureEdits);
  await page.setViewportSize({ width: 1366, height: 900 });
  const areas = Array.from({ length: 50 }, (_, i) => {
    const yaw = (i % 10 - 4.5) * 7, pitch = (Math.floor(i / 10) - 2) * 10;
    return {
      id: `perf-${i}`, kind: "SPATIAL_AREA", sceneId: "scene-a", label: `Area ${i}`,
      enabled: true, schemaVersion: 1, revision: 1, style: {}, action: { type: "none" },
      geometry: { type: "spherical_polygon", vertices: [
        { yaw: yaw - 3, pitch: pitch + 4 }, { yaw: yaw + 3, pitch: pitch + 4 },
        { yaw: yaw + 3, pitch: pitch - 4 }, { yaw: yaw - 3, pitch: pitch - 4 },
      ] },
    };
  });
  let count = 0;
  const pattern = "**/api/cms/virtual-tour/spatial-browser-station/structure*";
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    for (const scene of data.scenes) scene.spatialEntities = scene.sceneId === "scene-a" ? areas.slice(0, count) : [];
    await route.fulfill({ response, json: data });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const runs = [];
  try {
    for (const n of [0, 50, 0, 50, 0, 50]) {
      count = n;
      await page.reload();
      await page.waitForFunction(() => window.__spatialTestViewer?.isLoaded());
      await page.getByRole("button", { name: "Geser", exact: true }).click();
      const before = await cdp.send("Performance.getMetrics");
      const timing = await page.evaluate(async () => {
        const viewer = window.__spatialTestViewer;
        viewer.setYaw(0, 0); viewer.setPitch(0, 0); viewer.setHfov(100, 0);
        const times = [];
        let previous = null, started = null;
        await new Promise((resolve) => {
          const tick = (now) => {
            if (started === null) started = now;
            const elapsed = now - started;
            viewer.setYaw(Math.sin(elapsed / 1300) * 35, 0);
            if (elapsed > 1500 && previous !== null) times.push(now - previous);
            previous = now;
            if (elapsed < 7500) requestAnimationFrame(tick); else resolve();
          };
          requestAnimationFrame(tick);
        });
        const sorted = [...times].sort((a, b) => a - b);
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const paths = [...document.querySelectorAll(".spatial-area-fill")];
        if (paths.some((p) => {
          const geometry = p.getAttribute("points") ?? p.getAttribute("d");
          return !geometry || /NaN|Infinity/.test(geometry);
        })) throw new Error("Missing or nonfinite area geometry");
        return {
          fps: Number((1000 / mean).toFixed(1)), frames: times.length,
          p95FrameMs: Number(sorted[Math.floor(sorted.length * .95)].toFixed(2)),
          paths: paths.length,
        };
      });
      const after = await cdp.send("Performance.getMetrics");
      const delta = (name) => Number((1000 * (after.metrics.find((m) => m.name === name).value - before.metrics.find((m) => m.name === name).value)).toFixed(1));
      runs.push({ areas: n, ...timing, scriptMs: delta("ScriptDuration"), layoutMs: delta("LayoutDuration"), styleMs: delta("RecalcStyleDuration") });
    }
  } finally {
    await page.unroute(pattern);
    await cdp.detach();
    page.off("dialog", discardFixtureEdits);
  }
  return runs;
}
