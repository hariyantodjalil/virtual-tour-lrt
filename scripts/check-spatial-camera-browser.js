// Playwright CLI function expression; uses only isolated GET fixture overrides.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Invoked by playwright-cli run-code --filename.
async (page) => {
  if (!page.url().startsWith("http://127.0.0.1:3100/cms/virtual-tour/spatial-browser-station")) throw new Error("Local fixture required");
  const pattern = "**/api/cms/virtual-tour/spatial-browser-station/structure*";
  let empty = false;
  const discardFixtureEdits = async (dialog) => {
    if (dialog.type() !== "beforeunload") throw new Error(`Unexpected dialog: ${dialog.type()}`);
    await dialog.accept();
  };
  page.on("dialog", discardFixtureEdits);
  const vertices = [{ yaw: -12, pitch: 8 }, { yaw: 12, pitch: 8 }, { yaw: 12, pitch: -8 }, { yaw: -12, pitch: -8 }];
  await page.route(pattern, async (route) => {
    const response = await route.fetch(), data = await response.json();
    data.scenes[0].spatialEntities = empty ? [] : [{
      id: "camera-check", kind: "SPATIAL_AREA", sceneId: "scene-a", label: "Boundary test",
      geometry: { type: "spherical_polygon", vertices }, style: {}, action: { type: "none" },
      enabled: true, schemaVersion: 1, revision: 1,
    }];
    await route.fulfill({ response, json: data });
  });
  const results = [];
  const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const discardEdits = async () => {
    await page.getByText("Checkpoint 2", { exact: true }).click();
    await page.getByRole("button", { name: "Buang dan pindah", exact: true }).click();
    await settle();
  };
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.reload();
    await page.waitForFunction(() => window.__spatialTestViewer?.isLoaded());
    await page.getByRole("button", { name: "Boundary test", exact: true }).waitFor();
    for (const yaw of [0, 30, 180, -179, 0]) {
      await page.evaluate((value) => window.__spatialTestViewer.setYaw(value, 0), yaw);
      await settle();
      const visible = await page.locator(".spatial-area-fill").isVisible();
      if (visible !== (Math.abs(yaw) < 90)) throw new Error(`Incorrect culling at yaw ${yaw}`);
      if (visible) {
        const error = await page.evaluate(() => {
          const v = window.__spatialTestViewer;
          const box = v.getContainer().getBoundingClientRect();
          const rad = (d) => d * Math.PI / 180;
          const a = rad(v.getYaw()), b = rad(v.getPitch()), y = rad(-12), p = rad(8);
          const dir = [Math.cos(p)*Math.sin(y),Math.sin(p),Math.cos(p)*Math.cos(y)];
          const forward = [Math.cos(b)*Math.sin(a),Math.sin(b),Math.cos(b)*Math.cos(a)];
          const right = [Math.cos(a),0,-Math.sin(a)];
          const up = [-Math.sin(b)*Math.sin(a),Math.cos(b),-Math.sin(b)*Math.cos(a)];
          const dot = (x,z) => x.reduce((sum,n,i)=>sum+n*z[i],0);
          const f = box.width/2/Math.tan(rad(v.getHfov())/2), depth = dot(dir,forward);
          const shape = document.querySelector(".spatial-area-fill");
          const geometry = shape.getAttribute("points") ?? shape.getAttribute("d");
          const first = geometry.match(/-?\d+(?:\.\d+)?/g).map(Number);
          return Math.hypot(first[0]-(box.width/2+f*dot(dir,right)/depth),first[1]-(box.height/2-f*dot(dir,up)/depth));
        });
        if (error > 3) throw new Error(`Overlay drift ${error}px at ${yaw}`);
      }
    }
    results.push("camera pan/culling returns to correct area, alignment within 3px");
    await page.setViewportSize({ width: 768, height: 900 });
    await settle();
    const sizeOk = await page.evaluate(() => {
      const box = window.__spatialTestViewer.getContainer().getBoundingClientRect();
      const svg = document.querySelector(".cms-vt-panorama svg");
      const parts = svg.getAttribute("viewBox").split(" ").map(Number);
      return Math.abs(parts[2]-box.width)<1 && Math.abs(parts[3]-box.height)<1;
    });
    if (!sizeOk) throw new Error("Overlay viewport stale after resize");
    await page.setViewportSize({ width: 1366, height: 900 });
    await settle();
    results.push("ResizeObserver realigns SVG viewport");
    await page.getByRole("button", { name: "Boundary test", exact: true }).focus();
    await page.keyboard.press("Enter");
    const handles = page.locator("circle[aria-label^='Titik ']");
    await page.waitForFunction(() => document.querySelectorAll("circle[aria-label^='Titik ']").length === 4);
    const first = await handles.first().boundingBox();
    await page.mouse.move(first.x+first.width/2,first.y+first.height/2);
    await page.mouse.down();
    await page.mouse.move(first.x+first.width/2+20,first.y+first.height/2+10,{steps:5});
    await page.mouse.up();
    await settle();
    await page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true }).click();
    await settle();
    const restored = await handles.first().boundingBox();
    if (Math.hypot(restored.x-first.x,restored.y-first.y)>1) throw new Error("Drag/undo regression");
    results.push("keyboard selection and drag-one-undo preserved");
    await page.getByRole("button", {name:"Tambah titik setelah titik 1",exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll("circle[aria-label^='Titik ']").length === 5);
    await handles.nth(1).focus();
    await page.keyboard.press("Delete");
    await page.waitForFunction(() => document.querySelectorAll("circle[aria-label^='Titik ']").length === 4);
    await page.getByRole("button", {name:"Geser",exact:true}).click();
    if (await page.locator(".spatial-hit").count()) throw new Error("Pan captures polygon");
    await page.evaluate(() => window.__spatialTestViewer.setYaw(20,0));
    await settle();
    if (!await page.locator(".spatial-area-fill").isVisible()) throw new Error("Selected area lost while panning");
    await page.getByRole("button", {name:"Pilih",exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll("circle[aria-label^='Titik ']").length === 4);
    results.push("vertex insert/delete and edit/pan transitions preserved");
    const tools = page.getByRole("group",{name:"Unit komersial — pilih bentuk",exact:true});
    if (!await tools.getByRole("button",{name:/Pin/}).isEnabled() || !await tools.getByRole("button",{name:"Spatial",exact:true}).isEnabled()) throw new Error("Unit shape choice changed");
    results.push("Unit Pin/Spatial both available");
    await discardEdits();
    empty = true;
    await page.reload();
    await page.waitForFunction(() => window.__spatialTestViewer?.isLoaded());
    await tools.getByRole("button", { name: "Spatial", exact: true }).click();
    const canvas = await page.locator(".cms-vt-panorama").boundingBox();
    // Keep the draw gesture above the fixture's existing Unit Pin hit target.
    for (const [dx, dy] of [[-80,-160],[80,-160],[80,-80],[-80,-80]]) {
      await page.mouse.click(canvas.x + canvas.width / 2 + dx, canvas.y + canvas.height / 2 + dy);
    }
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll("circle[aria-label^='Titik ']").length === 4);
    results.push("first area can be drawn after the empty-overlay RAF is stopped");
    await discardEdits();
    await page.evaluate((checks) => sessionStorage.setItem("spatial-camera-check", JSON.stringify({ passed: true, checks })), results);
  } catch (error) {
    await page.screenshot({ path: "output/playwright/spatial-check-failed.png" });
    await page.evaluate((state) => sessionStorage.setItem("spatial-camera-check", JSON.stringify(state)), { passed: false, message: String(error), completed: results });
    throw error;
  } finally {
    await page.unroute(pattern);
    await page.reload();
    page.off("dialog", discardFixtureEdits);
  }
  return results;
}
