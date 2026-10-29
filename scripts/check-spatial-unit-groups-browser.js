// Local fixture verification; intercepts GET data and blocks all CMS writes.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI invokes the function expression.
async (page) => {
  if (!page.url().startsWith("http://127.0.0.1:3100/cms/virtual-tour/spatial-browser-station")) throw new Error("Local fixture required");
  const pattern="**/api/cms/virtual-tour/spatial-browser-station/structure*";
  const writes=[];
  const blockWrites=async route=>{
    if (["POST","PUT","PATCH","DELETE"].includes(route.request().method())) { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  };
  let hideFirstLabel=false;
  const face=(id,unitId,spaceCode,left,right,top,bottom)=>({
    id,unitId,spaceCode,kind:"SPATIAL_AREA",sceneId:"scene-a",label:id,enabled:true,schemaVersion:1,revision:1,
    style:{},action:{type:"unit_detail",targetId:unitId??"fixture-unit-a"},
    geometry:{type:"spherical_polygon",vertices:[{yaw:left,pitch:top},{yaw:right,pitch:top},{yaw:right,pitch:bottom},{yaw:left,pitch:bottom}]},
  });
  await page.route("**/api/cms/**",blockWrites);
  await page.route(pattern,async route=>{
    const response=await route.fetch(),data=await response.json();
    const front=face("unit-a-front","fixture-unit-a","TEST-UNIT-001",-18,-2,18,6);
    if (hideFirstLabel) front.style.showLabel=false;
    data.scenes[0].hotspots=[];
    data.scenes[0].spatialEntities=[front,face("unit-a-side",null,"TEST-UNIT-001",-2,14,18,6),face("unit-b","fixture-unit-b","TEST-UNIT-OTHER",30,44,-15,-28)];
    await route.fulfill({response,json:data});
  });
  const shape=id=>page.locator(`[data-spatial-entity="${id}"] .spatial-area-fill`);
  const hit=id=>page.locator(`[data-spatial-entity="${id}"] .spatial-hit`);
  const unitLabel=()=>page.locator(".spatial-badge").filter({hasText:"TEST-UNIT-001"});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  const assertSharedHighlight=async()=>{
    for (const id of ["unit-a-front","unit-a-side"]) {
      if (!(await shape(id).getAttribute("class")).includes("is-hovered")) throw new Error(`${id} did not highlight with its sibling`);
    }
    if ((await shape("unit-b").getAttribute("class")).includes("is-hovered")) throw new Error("Unrelated unit highlighted");
  };
  const results=[];
  try {
    await page.setViewportSize({width:1536,height:960});
    await page.reload();
    await page.waitForFunction(()=>window.__spatialTestViewer?.isLoaded());
    await page.waitForFunction(()=>document.querySelectorAll(".spatial-area-fill").length===3);
    if (await page.locator(".spatial-badge").count()!==2 || await unitLabel().count()!==1) throw new Error("Expected one label per unit");
    const pill=await unitLabel().locator("rect").last().evaluate(el=>({fill:el.getAttribute("fill"),stroke:el.getAttribute("stroke")}));
    const ink=await unitLabel().locator("text").first().getAttribute("fill");
    if (pill.fill!=="#FFFFFF" || pill.stroke!=="#A2DAC0" || ink!=="#166C4A") throw new Error(`Label palette mismatch: ${JSON.stringify({pill,ink})}`);
    results.push("two unit faces share one white label with green text, border and arrow");
    await hit("unit-a-front").hover();await settle();await assertSharedHighlight();
    await hit("unit-a-side").hover();await settle();await assertSharedHighlight();
    await unitLabel().hover();await settle();await assertSharedHighlight();
    await page.getByRole("heading",{name:"Editor Station Virtual Tour",exact:true}).hover();await settle();
    if (await page.locator(".spatial-area-fill.is-hovered").count()) throw new Error("Highlight remained after pointer left");
    results.push("either face and their shared label highlight both faces, with unrelated unit unchanged");
    await hit("unit-a-front").focus();await settle();await assertSharedHighlight();
    await hit("unit-a-side").click();await settle();
    if (!(await shape("unit-a-side").getAttribute("class")).includes("is-selected")) throw new Error("Individual face selection failed");
    if ((await shape("unit-a-front").getAttribute("class")).includes("is-selected")) throw new Error("Sibling was selected instead of the clicked face");
    if (await page.locator("circle[aria-label^='Titik ']").count()!==4) throw new Error("Selected face lost edit handles");
    const original=await shape("unit-a-side").getAttribute("points");
    const box=await page.locator("circle[aria-label^='Titik ']").first().boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+8,box.y+box.height/2+6,{steps:4});await page.mouse.up();await settle();
    const moved=await shape("unit-a-side").getAttribute("points");
    if (moved===original) throw new Error("Grouped face vertex did not move");
    await page.getByRole("button",{name:"Undo (Ctrl+Z)",exact:true}).click();await settle();
    if (await shape("unit-a-side").getAttribute("points")!==original) throw new Error("Grouped face undo failed");
    await page.getByRole("button",{name:"Redo (Ctrl+Y)",exact:true}).click();await settle();
    if (await shape("unit-a-side").getAttribute("points")!==moved) throw new Error("Grouped face redo failed");
    if (await unitLabel().count()!==1) throw new Error("Editing duplicated unit label");
    results.push("faces remain individually selectable and editable; vertex drag, undo and redo preserve one unit label");
    await hit("unit-a-side").hover();await settle();await assertSharedHighlight();
    await page.screenshot({path:"output/playwright/spatial-unit-group-labels.png"});
    await page.getByRole("button",{name:"Geser",exact:true}).click();
    await page.evaluate(()=>window.__spatialTestViewer.setYaw(55,0));await settle();
    if (await shape("unit-a-front").count()!==0 || await unitLabel().count()!==1) throw new Error("Label did not follow the remaining visible face");
    results.push("shared label stays visible when its original face leaves the viewport");
    // Discard local edits using the CMS dialog before reloading the fixture.
    await page.getByText("Checkpoint 2",{exact:true}).click();
    await page.getByRole("button",{name:"Buang dan pindah",exact:true}).click();await settle();
    hideFirstLabel=true;
    await page.reload();await page.waitForFunction(()=>window.__spatialTestViewer?.isLoaded());
    await page.waitForFunction(()=>document.querySelectorAll(".spatial-area-fill").length===3);
    if (await unitLabel().count()!==1) throw new Error("A hidden label on one face hid the entire unit label");
    results.push("a second label-enabled face supplies the shared label when the first face label is disabled");
    if (writes.length) throw new Error(`Unexpected CMS write attempted: ${writes.join(", ")}`);
    return results;
  } catch(error) {
    await page.screenshot({path:"output/playwright/spatial-unit-groups-failed.png"});
    throw error;
  } finally {
    await page.unroute(pattern);
    await page.unroute("**/api/cms/**",blockWrites);
  }
}
