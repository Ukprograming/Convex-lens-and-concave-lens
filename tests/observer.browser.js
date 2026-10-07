async page => {
  const results=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const check=(ok,message)=>{if(!ok)throw new Error(message);results.push(message);};
  const read=()=>page.evaluate(()=>{
    const eye=document.getElementById('observer'),s=document.getElementById('scene'),v=s.viewBox.baseVal;
    return {x:Number(eye.dataset.x),y:Number(eye.dataset.y),camera:[v.x,v.y,v.width,v.height],
      projection:document.querySelector('[data-projected] > g')?.getAttribute('transform'),
      aperture:document.querySelector('[id^="view-aperture-"] circle')?.getAttribute('cy'),
      title:document.getElementById('view-title').textContent,
      lenses:[...document.querySelectorAll('[data-drag="lens"]')].map(el=>el.getAttribute('aria-valuenow'))};
  });
  const eyePoint=()=>page.evaluate(()=>{
    const eye=document.getElementById('observer'),p=new DOMPoint(0,0).matrixTransform(eye.getScreenCTM());
    const s=document.getElementById('scene'),r=s.getBoundingClientRect();
    return {x:p.x,y:p.y,unit:r.width/s.viewBox.baseVal.width*3};
  });
  const drag=async(dx,dy)=>{
    const p=await eyePoint();await page.mouse.move(p.x,p.y);await page.mouse.down();
    await page.mouse.move(p.x+dx*p.unit,p.y-dy*p.unit,{steps:10});await page.mouse.up();
  };
  const reset=async()=>{
    await page.locator('#reset').click();await page.locator('#show-view').check();
  };
  const settled=()=>page.waitForFunction(()=>{
    const s=document.getElementById('scene'),r=s.getBoundingClientRect(),v=s.viewBox.baseVal;
    return Math.abs(r.width/r.height-v.width/v.height)<.00001;
  });
  await page.setViewportSize({width:1280,height:800});await settled();await reset();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  check((await page.locator('#observer-panel').boundingBox()).width===270,'Desktop observer panel grows from 190 to 270 pixels');
  let a=await read();await drag(-20,20);let b=await read();
  check(b.x===120 && b.y===20,'Mouse drags the eye horizontally and vertically');
  check(JSON.stringify(a.camera)===JSON.stringify(b.camera) && JSON.stringify(a.lenses)===JSON.stringify(b.lenses),'Eye drag preserves the camera and lens selection/configuration');
  check(a.projection!==b.projection && a.aperture!==b.aperture,'Projection and lens aperture both follow the moving eye');
  await page.locator('#zoom-in').click();a=await read();await drag(-10,-15);b=await read();
  check(b.x===110 && b.y===5,'Eye drag uses the correct coordinates after zoom');
  check(JSON.stringify(a.camera)===JSON.stringify(b.camera),'Eye drag after zoom does not pan the canvas');
  await page.locator('#observer').focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('Shift+ArrowRight');
  b=await read();check(b.x===120 && b.y===6,'Arrow keys move the eye in both axes with a larger Shift step');
  await page.locator('#reset-view').click();b=await read();
  check(b.x===120 && b.y===6,'Reset view keeps the observer position');
  await reset();b=await read();check(b.x===140 && b.y===0,'Full reset restores the initial observer position');
  await page.getByRole('button',{name:'レンズなし',exact:true}).click();a=await read();await drag(-30,-20);b=await read();
  check(a.projection!==b.projection && b.title==='正立','Direct view follows the eye while retaining upright orientation');
  await reset();await page.locator('#observer').focus();
  for(let i=0;i<11;i++)await page.keyboard.press('Shift+ArrowLeft');
  check((await read()).title==='ピンぼけ（模式図）','Moving the eye to the real image switches to defocus');
  await page.keyboard.press('ArrowRight');check((await read()).title==='倒立','Moving past the real image restores the inverted projection');
  for(let i=0;i<5;i++)await page.keyboard.press('Shift+ArrowLeft');
  check((await read()).x===10,'Eye stops on the outgoing side of the last lens');
  for(let i=0;i<12;i++)await page.keyboard.press('Shift+ArrowUp');
  check((await read()).y===100,'Vertical eye movement stops at its documented boundary');
  await reset();await page.locator('#add-lens').click();await page.locator('#observer').focus();
  for(let i=0;i<12;i++)await page.keyboard.press('Shift+ArrowLeft');
  b=await read();check(b.x===50 && b.lenses.length===2,'Observer boundary follows the final lens in a compound system');
  await reset();await page.setViewportSize({width:820,height:1180});await settled();
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:8,radiusY:8,force:1}))});
  const p=await eyePoint();a=await read();
  await touch('touchStart',[[1,p.x,p.y]]);await touch('touchMove',[[1,p.x-25*p.unit,p.y-30*p.unit]]);await touch('touchEnd',[]);
  b=await read();check(b.x===115 && b.y===30 && a.projection!==b.projection,'One-finger eye drag updates the view on a tablet-sized screen');
  check(JSON.stringify(a.camera)===JSON.stringify(b.camera),'Touch eye drag does not pan the scene');
  const q=await eyePoint();a=await read();
  await touch('touchStart',[[1,q.x,q.y]]);await touch('touchStart',[[1,q.x,q.y],[2,q.x-100,q.y]]);
  await touch('touchMove',[[1,q.x+20,q.y],[2,q.x-120,q.y]]);await touch('touchEnd',[]);
  b=await read();check(b.x===a.x && b.y===a.y && b.camera[2]<a.camera[2],'Adding a second finger to the eye starts pinch zoom without moving the observer');
  await reset();await page.screenshot({path:'output/playwright/observer-tablet.png'});
  for(const [width,height,minPanel,name] of [[1280,800,270,'desktop'],[375,667,150,'narrow'],[667,375,140,'short-landscape']]){
    await page.setViewportSize({width,height});await settled();
    const panel=await page.locator('#observer-panel').boundingBox(),scene=await page.locator('#scene').boundingBox();
    check(panel.width>=minPanel && panel.x>=scene.x && panel.y>=scene.y && panel.x+panel.width<=scene.x+scene.width && panel.y+panel.height<=scene.y+scene.height,`${name} enlarged panel stays inside the canvas`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} has no horizontal overflow`);
    await page.screenshot({path:`output/playwright/observer-${name}.png`});
  }
  check(errors.length===0,'No JavaScript runtime errors during observer interaction');
  return {passed:results.length,results};
}
