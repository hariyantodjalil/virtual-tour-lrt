// Uses only the disposable local fixture prepared by prepare-spatial-browser.mts.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Browser runner invokes this function expression.
async(page)=>{
  if(!page.url().startsWith("http://127.0.0.1:3100/cms/virtual-tour/spatial-browser-station"))throw new Error("Disposable local fixture required");
  const results=[];
  const view=()=>page.evaluate(()=>{const v=window.__spatialTestViewer;return {yaw:v.getYaw(),pitch:v.getPitch(),hfov:v.getHfov()};});
  const near=async(expected)=>{
    await page.waitForFunction(expected=>{const v=window.__spatialTestViewer;return v?.isLoaded()&&Math.abs(v.getYaw()-expected.yaw)<.2&&Math.abs(v.getPitch()-expected.pitch)<.2&&Math.abs(v.getHfov()-expected.hfov)<.2;},expected);
  };
  const setCamera=async(camera)=>{
    await page.evaluate(c=>{const v=window.__spatialTestViewer;v.setYaw(c.yaw,0);v.setPitch(c.pitch,0);v.setHfov(c.hfov,0);},camera);
    await near(camera);
  };
  await page.locator(".lrt-editor-hs").first().click();
  await page.getByRole("button",{name:"Atur arah di scene tujuan",exact:true}).click();
  await page.locator("[data-scene-entry-camera] .pnlm-render-container canvas").waitFor();
  await near({yaw:160,pitch:2,hfov:95});
  await setCamera({yaw:20,pitch:3,hfov:80});
  await page.getByRole("button",{name:"Batal",exact:true}).click();
  if(await page.locator("[data-scene-entry-status]").textContent()!=="Bawaan scene tujuan")throw new Error("Cancel changed connection");
  results.push("Dialog opens destination default; cancel leaves connection unchanged");

  const selected={yaw:65,pitch:4,hfov:88};
  await page.getByRole("button",{name:"Atur arah di scene tujuan",exact:true}).click();
  await near({yaw:160,pitch:2,hfov:95});
  await setCamera(selected);
  await page.screenshot({path:"output/playwright/scene-entry-desktop.png"});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"output/playwright/scene-entry-mobile.png"});
  const mobileFits=await page.getByRole("dialog").evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight;});
  if(!mobileFits)throw new Error("Arrival camera dialog overflows mobile viewport");
  await page.setViewportSize({width:1366,height:900});
  await setCamera(selected);
  await page.getByRole("button",{name:"Gunakan arah ini",exact:true}).click();
  await page.locator("[data-scene-entry-status]").filter({hasText:"Yaw 65.0"}).waitFor();
  await page.getByTitle("Undo (Ctrl+Z)",{exact:true}).click();
  if(await page.locator("[data-scene-entry-status]").textContent()!=="Bawaan scene tujuan")throw new Error("Undo did not restore inherited camera");
  await page.getByTitle("Redo (Ctrl+Y)",{exact:true}).click();
  await page.locator("[data-scene-entry-status]").filter({hasText:"Yaw 65.0"}).waitFor();
  await page.getByRole("button",{name:"Ikuti arah bawaan scene",exact:true}).click();
  if(await page.locator("[data-scene-entry-status]").textContent()!=="Bawaan scene tujuan")throw new Error("Reset did not remove custom camera");
  await page.getByTitle("Undo (Ctrl+Z)",{exact:true}).click();
  await page.locator("[data-scene-entry-status]").filter({hasText:"Yaw 65.0"}).waitFor();
  results.push("Apply, undo, redo, and reset operate on arrival view");

  const responsePromise=page.waitForResponse(r=>r.url().endsWith("/api/cms/virtual-tour/spatial-browser-station/scene-a")&&r.request().method()==="PUT");
  await page.getByRole("button",{name:"Simpan",exact:true}).click();
  const response=await responsePromise;
  if(!response.ok())throw new Error(`Fixture save failed: ${response.status()}`);
  const saved=await response.json();
  const connection=saved.hotspots.find(h=>h.type==="scene"&&h.sceneId==="scene-b");
  if(!connection?.targetView||Object.entries(selected).some(([key,value])=>Math.abs(connection.targetView[key]-value)>.2))throw new Error(`Arrival view not persisted: ${JSON.stringify(connection?.targetView)}`);
  await page.reload();
  await page.locator(".lrt-editor-hs").first().click();
  await page.locator("[data-scene-entry-status]").filter({hasText:"Yaw 65.0"}).waitFor();
  results.push("Arrival view persisted through real fixture API save and reload");

  await page.getByRole("button",{name:"Preview",exact:true}).click();
  await page.locator(".lrt-scene-hotspot").click();
  await near(selected);
  results.push("CMS preview arrives with the configured camera");

  await page.goto("http://127.0.0.1:3100/station/spatial-browser-test");
  await page.waitForFunction(()=>window.__spatialTestViewer?.isLoaded());
  await page.locator(".lrt-scene-hotspot").click();
  await page.waitForFunction(()=>window.__spatialTestViewer.getScene()==="scene-b");
  await near(selected);
  await page.waitForFunction(()=>document.querySelector('.lrt-vt-viewer > div[aria-hidden="true"]')?.style.opacity==="0");
  await page.locator(".lrt-scene-hotspot").click();
  await page.waitForFunction(()=>window.__spatialTestViewer.getScene()==="scene-a");
  await near({yaw:-85,pitch:1,hfov:105});
  results.push("Public A to B and B to A use distinct arrival directions");
  const reset=await page.request.put("http://127.0.0.1:3100/api/cms/virtual-tour/spatial-browser-station/scene-a",{data:{hotspots:saved.hotspots.map(h=>({...h,targetView:undefined}))}});
  if(!reset.ok())throw new Error("Cannot reset fixture arrival view");
  await page.reload();
  await page.waitForFunction(()=>window.__spatialTestViewer?.isLoaded());
  await page.locator(".lrt-scene-hotspot").click();
  await page.waitForFunction(()=>window.__spatialTestViewer.getScene()==="scene-b");
  await near({yaw:160,pitch:2,hfov:95});
  results.push("Removing the override restores destination initial view in the public viewer");
  return {results,finalCamera:await view()};
}
