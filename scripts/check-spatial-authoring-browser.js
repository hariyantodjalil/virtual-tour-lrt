// Local disposable CMS fixture only. No API writes are allowed during this check.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI invokes the function expression.
async (page) => {
  if (!page.url().startsWith("http://127.0.0.1:3100/cms/virtual-tour/spatial-browser-station")) throw new Error("Local fixture required");
  const pattern = "**/api/cms/virtual-tour/spatial-browser-station/structure*";
  const read = () => page.evaluate(() => {
    const el = document.querySelector(".cms-vt-panorama");
    const props=el?.[Object.keys(el).find((key)=>key.startsWith("__reactProps$"))];
    const children=Array.isArray(props?.children)?props.children:[props?.children];
    const overlay=children.find(child=>child?.props && "draftVertices" in child.props && "entities" in child.props);
    if (!overlay) throw new Error("Committed overlay props not found");
    const p=overlay.props;
    return {draft:p.draftVertices,entities:p.entities,selected:p.selectedId,hotspotCount:el.querySelectorAll(".lrt-editor-hs").length,blurCount:el.querySelectorAll(".lrt-editor-blur").length};
  });
  const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const writes = [];
  const blockWrites = async (route) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method())) {
      writes.push(route.request().url());
      await route.abort();
    } else await route.continue();
  };
  await page.route("**/api/cms/**", blockWrites);
  await page.route(pattern, async (route) => {
    const response = await route.fetch(), data = await response.json();
    data.scenes[0].spatialEntities = [{
      id: "existing-unit-face", kind: "SPATIAL_AREA", sceneId: "scene-a", label: "Existing face",
      unitId: "fixture-unit", spaceCode: "TEST-UNIT-001", enabled: true, schemaVersion: 1, revision: 1,
      geometry: {type:"spherical_polygon",vertices:[{yaw:-35,pitch:25},{yaw:-25,pitch:25},{yaw:-25,pitch:15},{yaw:-35,pitch:15}]},
      style: {}, action: {type:"unit_detail",targetId:"fixture-unit"},
    }];
    await route.fulfill({response,json:data});
  });
  const results = [];
  const sameVertices = (a,b) => a.length === b.length && a.every((v,i)=>Math.abs(v.yaw-b[i].yaw)<1e-8 && Math.abs(v.pitch-b[i].pitch)<1e-8);
  async function drawAndFinish(label) {
    const box = await page.locator(".cms-vt-panorama").boundingBox();
    for (const [dx,dy] of [[30,-180],[140,-180],[140,-90],[30,-90]]) {
      await page.mouse.click(box.x+box.width/2+dx,box.y+box.height/2+dy);
    }
    const before = await read();
    if (before.draft.length !== 4) throw new Error(`${label}: expected 4 draft vertices, got ${before.draft.length}`);
    await page.getByRole("heading",{name:"Editor Station Virtual Tour",exact:true}).click();
    await settle();
    if (!sameVertices((await read()).draft,before.draft)) throw new Error(`${label}: clicking outside the panorama added a vertex`);
    await page.locator(".cms-vt-panorama .pnlm-zoom-in").click();
    await settle();
    if (!sameVertices((await read()).draft,before.draft)) throw new Error(`${label}: zoom control added a vertex`);
    await page.evaluate(()=>window.__spatialTestViewer.setHfov(100,0));
    await settle();
    await page.evaluate(()=>window.addEventListener("pointerdown",event=>{window.__spatialTestPointer=event.pointerId;},{capture:true,once:true}));
    await page.mouse.move(box.x+box.width/2+85,box.y+box.height/2-130);
    await page.mouse.down();
    await page.evaluate(()=>window.dispatchEvent(new PointerEvent("pointercancel",{pointerId:window.__spatialTestPointer,isPrimary:true})));
    await page.mouse.up();
    await settle();
    if (!sameVertices((await read()).draft,before.draft)) throw new Error(`${label}: cancelled gesture added a vertex`);
    await page.getByRole("button",{name:"Selesaikan area",exact:true}).click();
    await settle();
    const after = await read();
    const entity = after.entities.find((e)=>e.id===after.selected);
    if (after.draft.length || !entity || after.entities.length!==before.entities.length+1 || !sameVertices(entity.geometry.vertices,before.draft)) {
      throw new Error(`${label}: finish changed geometry; draft=${after.draft.length}, committed=${entity?.geometry.vertices.length ?? 0}`);
    }
    results.push(`${label}: finishing by button preserves all four vertices`);
    return entity;
  }
  async function dragAndUndo(entity,label) {
    const handle=page.locator("circle[aria-label^='Titik ']").first();
    const box=await handle.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+24,box.y+box.height/2+12,{steps:1});
    await page.mouse.up();
    await settle();
    const changed=(await read()).entities.find(e=>e.id===entity.id);
    if (JSON.stringify(changed.geometry.vertices)===JSON.stringify(entity.geometry.vertices)) throw new Error(`${label}: vertex drag did not commit`);
    if (JSON.stringify(changed.geometry.vertices.slice(1))!==JSON.stringify(entity.geometry.vertices.slice(1))) throw new Error(`${label}: drag moved unrelated vertices`);
    await page.getByRole("button",{name:"Undo (Ctrl+Z)",exact:true}).click();
    await settle();
    const restored=(await read()).entities.find(e=>e.id===entity.id);
    if (JSON.stringify(restored.geometry.vertices)!==JSON.stringify(entity.geometry.vertices)) throw new Error(`${label}: single undo did not restore geometry`);
    results.push(`${label}: vertex drag and one undo work`);
  }
  try {
    await page.setViewportSize({width:1536,height:960});
    await page.reload();
    await page.waitForFunction(()=>window.__spatialTestViewer?.isLoaded());
    await page.getByRole("group",{name:"Unit komersial — pilih bentuk",exact:true}).getByRole("button",{name:"Spatial",exact:true}).click();
    const fresh=await drawAndFinish("new area");
    await dragAndUndo(fresh,"new area");
    await page.getByRole("group",{name:"Daftar Spatial Area",exact:true}).getByRole("button").filter({hasText:"Existing face"}).click();
    await page.getByRole("button",{name:/Tambah sisi lain/}).click();
    const sibling=await drawAndFinish("additional unit face");
    if (sibling.unitId!=="fixture-unit" || sibling.spaceCode!=="TEST-UNIT-001" || sibling.action.type!=="unit_detail") throw new Error("Sibling lost unit binding");
    await dragAndUndo(sibling,"additional unit face");
    const tools=page.getByRole("group",{name:"Unit komersial — pilih bentuk",exact:true});
    const box=await page.locator(".cms-vt-panorama").boundingBox();
    const beforePin=await read();
    await tools.getByRole("button",{name:"Pin",exact:true}).click();
    await settle();
    await page.mouse.click(box.x+box.width/2+70,box.y+box.height/2-120);
    await settle();
    if ((await read()).hotspotCount!==beforePin.hotspotCount+1) throw new Error("Pin authoring regression");
    await page.getByRole("button",{name:"Undo (Ctrl+Z)",exact:true}).click();
    await settle();
    const beforeBlur=await read();
    await page.getByRole("group",{name:"Privasi",exact:true}).getByRole("button",{name:"Blur",exact:true}).click();
    await settle();
    await page.mouse.click(box.x+box.width/2+70,box.y+box.height/2-120);
    await settle();
    if ((await read()).blurCount!==beforeBlur.blurCount+1) throw new Error("Blur authoring regression");
    await page.getByRole("button",{name:"Undo (Ctrl+Z)",exact:true}).click();
    results.push("Pin and privacy blur authoring still work");
    if (writes.length) throw new Error(`Unexpected write attempted: ${writes.join(", ")}`);
    return results;
  } catch (error) {
    await page.screenshot({path:"output/playwright/spatial-authoring-failed.png"});
    throw error;
  } finally {
    await page.unroute(pattern);
    await page.unroute("**/api/cms/**", blockWrites);
  }
}
