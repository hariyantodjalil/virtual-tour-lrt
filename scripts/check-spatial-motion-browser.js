// Compares Spatial geometry with a native Pannellum marker during real vertical drags.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI invokes this function expression.
async(page)=>{
  if(!page.url().startsWith("http://127.0.0.1:3100/"))throw new Error("Local fixture required");
  const warnings=[];
  const capture=message=>{if(/flushSync|Cannot update a component.*rendering/.test(message.text()))warnings.push(message.text());};
  page.on("console",capture);
  await page.setViewportSize({width:1366,height:900});
  await page.goto("http://127.0.0.1:3100/station/spatial-browser-test");
  await page.waitForFunction(()=>window.__spatialTestViewer?.isLoaded());
  await page.locator('[data-spatial-entity="motion-face-0"] .spatial-area-fill').waitFor();
  await page.evaluate(()=>{
    const viewer=window.__spatialTestViewer;
    viewer.setHfov(80,0);viewer.setYaw(0,0);viewer.setPitch(0,0);
    viewer.addHotSpot({id:"motion-native-reference",pitch:8,yaw:-12,cssClass:"motion-native-reference",createTooltipFunc:div=>{
      Object.assign(div.style,{width:"2px",height:"2px",margin:"0",padding:"0",border:"none",background:"transparent",pointerEvents:"none"});
    }});
  });
  await page.waitForTimeout(250);
  await page.evaluate(()=>{
    const marker=document.querySelector(".motion-native-reference");
    const samples=[];
    let previousY=null;
    const measure=()=>{
      const shape=document.querySelector('[data-spatial-entity="motion-face-0"] .spatial-area-fill');
      if(!shape)return;
      const p=(shape.getAttribute("points")??shape.getAttribute("d")).match(/-?\d+(?:\.\d+)?/g).map(Number);
      const svg=shape.ownerSVGElement,point=svg.createSVGPoint();point.x=p[0];point.y=p[1];
      const screen=point.matrixTransform(svg.getScreenCTM());
      const native=marker.getBoundingClientRect();
      const y=native.y+native.height/2;
      return {y,error:Math.hypot(screen.x-native.x-native.width/2,screen.y-y),pitch:window.__spatialTestViewer.getPitch()};
    };
    const observe=()=>{
      const sample=measure();if(!sample)return;
      const y=sample.y;
      const moving=previousY!==null&&Math.abs(y-previousY)>0.25;
      previousY=y;
      if(moving)samples.push(sample);
    };
    const observer=new MutationObserver(observe);observer.observe(marker,{attributes:true,attributeFilter:["style"]});
    window.__spatialMotionCheck={samples,observer,measure};
  });
  const box=await page.locator(".lrt-vt-viewer").boundingBox();
  const x=box.x+box.width*0.78,y=box.y+box.height*0.47;
  for(const direction of [1,-1,1,-1]){
    await page.mouse.move(x,y);await page.mouse.down();
    for(let step=1;step<=24;step++){
      await page.mouse.move(x,y+direction*step*5);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();await page.waitForTimeout(180);
  }
  await page.waitForTimeout(350);
  const result=await page.evaluate(()=>{
    const check=window.__spatialMotionCheck;check.observer.disconnect();
    const errors=check.samples.map(s=>s.error).sort((a,b)=>a-b);
    return {samples:errors.length,maxErrorCssPx:errors.at(-1)??null,p95ErrorCssPx:errors[Math.floor(errors.length*.95)]??null,meanErrorCssPx:errors.reduce((a,b)=>a+b,0)/errors.length,settledErrorCssPx:check.measure()?.error??null};
  });
  if(result.samples<30)throw new Error(`Insufficient moving frames: ${JSON.stringify(result)}`);
  if(result.maxErrorCssPx>3)throw new Error(`Spatial overlay drifts from the rendered panorama: ${JSON.stringify(result)}`);
  await page.getByTitle("Guided route",{exact:true}).click();
  const waitTransition=()=>page.waitForFunction(()=>document.querySelector('.lrt-vt-viewer > div[aria-hidden="true"]')?.style.opacity==="0");
  for(let cycle=0;cycle<2;cycle++){
    await page.getByRole("button").filter({hasText:"Checkpoint 2"}).click();
    await page.waitForFunction(()=>window.__spatialTestViewer.getScene()==="scene-b"&&window.__spatialTestViewer.isLoaded()&&!document.querySelector(".spatial-area-fill"));
    await waitTransition();
    const restored=await page.evaluate(()=>{const r=window.__spatialTestViewer.getRenderer();return r.render===window.__nativeRenderReferences.get(r);});
    if(!restored)throw new Error("Renderer hook not restored after overlay unmounted");
    await page.getByRole("button").filter({hasText:"Checkpoint 1"}).click();
    await page.waitForFunction(()=>window.__spatialTestViewer.getScene()==="scene-a"&&window.__spatialTestViewer.isLoaded()&&document.querySelectorAll(".spatial-area-fill").length===2);
    await waitTransition();
    const subscribed=await page.evaluate(()=>{const r=window.__spatialTestViewer.getRenderer();return r.render!==window.__nativeRenderReferences.get(r);});
    if(!subscribed)throw new Error("Renderer hook not reattached after returning to spatial scene");
  }
  page.off("console",capture);
  if(warnings.length)throw new Error(`React synchronization warnings: ${warnings.join("; ")}`);
  result.sceneSwitchCleanupCycles=2;
  return result;
}
