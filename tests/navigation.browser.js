async page => {
  const results=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const check=(ok,message)=>{if(!ok)throw new Error(message);results.push(message);};
  const close=(a,b,tolerance=.05)=>Math.abs(a-b)<tolerance;
  const settled=()=>page.waitForFunction(()=>{
    const s=document.getElementById('scene'),r=s.getBoundingClientRect(),v=s.viewBox.baseVal;
    return Math.abs(r.width/r.height-v.width/v.height)<.00001;
  });
  const read=()=>page.evaluate(()=>{
    const scene=document.getElementById('scene'),r=scene.getBoundingClientRect(),v=scene.viewBox.baseVal;
    return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},view:{x:v.x,y:v.y,width:v.width,height:v.height},
      candle:Number(document.getElementById('candle').getAttribute('aria-valuenow')),
      lenses:[...document.querySelectorAll('[data-drag="lens"]')].map(el=>Number(el.getAttribute('aria-valuenow'))),
      f:Number(document.querySelector('[data-drag="focus"]')?.getAttribute('aria-valuenow')),
      zoom:document.getElementById('zoom-level').textContent,
      pageScale:window.visualViewport.scale,scrollX:window.scrollX,scrollY:window.scrollY,
      overflow:document.documentElement.scrollWidth>window.innerWidth};
  });
  const screen=async(x,y)=>page.evaluate(({x,y})=>{
    const p=new DOMPoint(x,y).matrixTransform(document.getElementById('scene').getScreenCTM());
    return {x:p.x,y:p.y};
  },{x,y});
  const world=(state,p)=>({x:state.view.x+(p.x-state.rect.x)*state.view.width/state.rect.width,
    y:state.view.y+(p.y-state.rect.y)*state.view.height/state.rect.height});
  const mouseDrag=async(p,dx,dy)=>{
    await page.mouse.move(p.x,p.y);await page.mouse.down();
    await page.mouse.move(p.x+dx,p.y+dy,{steps:8});await page.mouse.up();
  };
  await page.setViewportSize({width:1280,height:800});
  await settled();
  await page.getByRole('button',{name:'↺ リセット',exact:true}).click();
  let a=await read();
  const pointer={x:Math.round(a.rect.x+a.rect.width*.66),y:Math.round(a.rect.y+a.rect.height*.65)},anchor=world(a,pointer);
  await page.mouse.move(pointer.x,pointer.y);await page.mouse.wheel(0,-240);
  await page.waitForFunction(()=>document.getElementById('zoom-level').textContent!=='100%');
  let b=await read(),afterAnchor=world(b,pointer);
  check(b.view.width<a.view.width && close(anchor.x,afterAnchor.x) && close(anchor.y,afterAnchor.y),'Mouse wheel zoom keeps the world point under the cursor');
  const blank={x:b.rect.x+45,y:b.rect.y+45};
  await mouseDrag(blank,80,45);a=await read();
  check(close(a.view.x,b.view.x-80*b.view.width/b.rect.width) && close(a.view.y,b.view.y-45*b.view.height/b.rect.height),'Blank drag pans in both axes');
  check(a.candle===-60 && a.lenses[0]===0 && a.f===20,'Pan and zoom preserve the optical configuration');
  await mouseDrag(await screen(300,220),30*a.rect.width/a.view.width,0);
  b=await read();check(b.candle===-50,'Candle drag moves 10 cm correctly after pan and zoom');
  await mouseDrag(await screen(480,210),30*b.rect.width/b.view.width,0);
  b=await read();check(b.lenses[0]===10,'Lens drag moves 10 cm correctly after pan and zoom');
  await mouseDrag(await screen(570,240),15*b.rect.width/b.view.width,0);
  b=await read();check(b.f===25,'Focus drag changes the focal length correctly after pan and zoom');
  await page.getByRole('checkbox',{name:'数式',exact:true}).check();
  await page.getByRole('checkbox',{name:'見え方',exact:true}).check();
  const overlayBefore=await page.locator('#observer-panel').boundingBox();
  await page.getByRole('button',{name:'拡大',exact:true}).click();
  const overlayAfter=await page.locator('#observer-panel').boundingBox();
  check(close(overlayBefore.x,overlayAfter.x) && close(overlayBefore.y,overlayAfter.y),'Observer overlay stays in the canvas corner during zoom');
  await page.getByRole('button',{name:'表示を戻す',exact:true}).click();
  b=await read();
  check(b.zoom==='100%' && b.candle===-50 && b.lenses[0]===10 && b.f===25,'View reset restores the camera and keeps the optical configuration');
  check(await page.getByRole('checkbox',{name:'見え方',exact:true}).isChecked(),'View reset preserves display settings');
  await page.evaluate(()=>{for(let i=0;i<12;i++)document.getElementById('zoom-in').click();});
  check((await read()).zoom==='400%' && await page.getByRole('button',{name:'拡大',exact:true}).isDisabled(),'Zoom stops at 400% and disables the increase button');
  await page.evaluate(()=>{for(let i=0;i<24;i++)document.getElementById('zoom-out').click();});
  check((await read()).zoom==='50%' && await page.getByRole('button',{name:'縮小',exact:true}).isDisabled(),'Zoom stops at 50% and disables the decrease button');
  await page.getByRole('button',{name:'↺ リセット',exact:true}).click();
  b=await read();check(b.zoom==='100%' && b.candle===-60 && b.lenses[0]===0 && b.f===20,'Full reset restores both the camera and optical state');

  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:8,radiusY:8,force:1}))});
  await page.setViewportSize({width:820,height:1180});
  await settled();
  await page.getByRole('button',{name:'↺ リセット',exact:true}).click();
  a=await read();
  let x=a.rect.x+80,y=a.rect.y+100;
  await touch('touchStart',[[1,x,y]]);await touch('touchMove',[[1,x+50,y+35]]);await touch('touchEnd',[]);
  b=await read();check(close(b.view.x,a.view.x-50*a.view.width/a.rect.width) && close(b.view.y,a.view.y-35*a.view.height/a.rect.height),'iPad-size one-finger blank drag pans');
  await page.getByRole('button',{name:'表示を戻す',exact:true}).click();
  a=await read();
  let p=await screen(300,220);
  await touch('touchStart',[[1,p.x,p.y]]);await touch('touchMove',[[1,p.x+30*a.rect.width/a.view.width,p.y]]);await touch('touchEnd',[]);
  check((await read()).candle===-50,'Touch drags the candle using transformed coordinates');
  await page.getByRole('button',{name:'↺ リセット',exact:true}).click();a=await read();
  const mid={x:a.rect.x+a.rect.width/2,y:a.rect.y+a.rect.height/2};
  const pinchAnchor=world(a,mid);
  await touch('touchStart',[[1,mid.x-60,mid.y],[2,mid.x+60,mid.y]]);
  await touch('touchMove',[[1,mid.x-120+25,mid.y+30],[2,mid.x+120+25,mid.y+30]]);
  b=await read();const movedAnchor=world(b,{x:mid.x+25,y:mid.y+30});
  check(b.zoom==='200%' && close(pinchAnchor.x,movedAnchor.x) && close(pinchAnchor.y,movedAnchor.y),'Two-finger pinch doubles zoom and follows the moving midpoint');
  check(b.candle===-60 && b.lenses[0]===0 && b.f===20 && b.pageScale===1,'Pinch preserves objects and browser page scale');
  await touch('touchEnd',[[2,mid.x+145,mid.y+30]]);a=await read();
  await touch('touchMove',[[1,mid.x-75,mid.y+40]]);await touch('touchEnd',[]);b=await read();
  check(close(b.view.x,a.view.x-20*a.view.width/a.rect.width) && b.candle===-60,'Remaining finger continues panning after pinch without moving objects');
  await page.getByRole('button',{name:'↺ リセット',exact:true}).click();
  p=await screen(480,210);
  await touch('touchStart',[[1,p.x,p.y]]);
  await touch('touchStart',[[1,p.x,p.y],[2,p.x+120,p.y]]);
  await touch('touchMove',[[1,p.x-30,p.y],[2,p.x+150,p.y]]);
  await touch('touchEnd',[]);b=await read();
  check(b.zoom==='150%' && b.lenses[0]===0,'Adding a second finger on a lens switches from object drag to pinch');
  a=await read();x=a.rect.x+40;y=a.rect.y+100;
  await touch('touchStart',[[1,x,y]]);await touch('touchMove',[[1,x+15,y+10]]);await touch('touchCancel',[]);
  a=await read();await touch('touchStart',[[1,x,y]]);await touch('touchMove',[[1,x+20,y+15]]);await touch('touchEnd',[]);b=await read();
  check(close(b.view.x,a.view.x-20*a.view.width/a.rect.width),'Touch cancellation releases the gesture and the next drag works');
  await page.getByRole('button',{name:'↺ リセット',exact:true}).click();
  await page.getByRole('button',{name:'＋ レンズ追加',exact:true}).click();
  a=await read();p=await screen(600,210);
  await touch('touchStart',[[1,p.x,p.y]]);await touch('touchMove',[[1,p.x+30*a.rect.width/a.view.width,p.y]]);await touch('touchEnd',[]);
  b=await read();check(b.lenses[0]===0 && b.lenses[1]===50,'Touch moves the selected second lens without moving the first');
  p=await screen(690,240);
  await touch('touchStart',[[1,p.x,p.y]]);await touch('touchMove',[[1,p.x+15*b.rect.width/b.view.width,p.y]]);await touch('touchEnd',[]);
  check((await read()).f===25,'Touch changes the selected second lens focal length');
  const zoomButton=await page.getByRole('button',{name:'拡大',exact:true}).boundingBox();
  await touch('touchStart',[[1,zoomButton.x+zoomButton.width/2,zoomButton.y+zoomButton.height/2]]);
  await touch('touchEnd',[]);
  check((await read()).zoom==='125%','Touch activates the zoom button');
  await page.getByRole('checkbox',{name:'光線',exact:true}).uncheck();
  check(await page.evaluate(()=>!document.getElementById('rays').innerHTML && !document.getElementById('image').innerHTML),'Ray display toggle still hides rays and images after camera and lens changes');
  await page.getByRole('button',{name:'↺ リセット',exact:true}).click();
  const beforeResize=await read();
  await page.setViewportSize({width:1180,height:820});
  await settled();
  b=await read();check(close(beforeResize.view.x+beforeResize.view.width/2,b.view.x+b.view.width/2) && close(beforeResize.view.y+beforeResize.view.height/2,b.view.y+b.view.height/2) && beforeResize.zoom===b.zoom,'Rotation-size change keeps the world center and zoom');
  check(!b.overflow && b.pageScale===1 && b.scrollX===0 && b.scrollY===0,'Landscape tablet has no page zoom or horizontal overflow');
  await page.getByRole('checkbox',{name:'見え方',exact:true}).check();
  await page.getByRole('checkbox',{name:'数式',exact:true}).check();
  await page.getByRole('button',{name:'表示を戻す',exact:true}).click();
  await page.screenshot({path:'output/playwright/tablet-landscape.png'});
  await page.setViewportSize({width:820,height:1180});
  await settled();
  await page.screenshot({path:'output/playwright/tablet-portrait.png'});
  await page.setViewportSize({width:375,height:667});
  await settled();
  b=await read();check(!b.overflow && b.rect.height>200,'Narrow screen retains a usable canvas without horizontal overflow');
  const controls=await page.locator('.canvas-navigation').boundingBox();
  check(controls.x>=b.rect.x && controls.x+controls.width<=b.rect.x+b.rect.width,'Zoom controls fit inside the narrow canvas');
  await page.screenshot({path:'output/playwright/narrow.png'});
  check(errors.length===0,'No JavaScript runtime errors during all mouse and touch scenarios');
  return {passed:results.length,results};
}
