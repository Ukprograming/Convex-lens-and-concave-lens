/* SVG interaction and sequential thin-lens rendering; no external dependencies. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),O=window.Optics;
  const initial=()=>({objectX:-60,lenses:[{id:1,x:0,f:20}],selected:1,nextId:2,none:false});
  let state=initial(),drag=null;
  const X=x=>480+3*x,Y=y=>240-3*y;
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const fmt=n=>Number.isFinite(n)?Number(n.toFixed(1)).toLocaleString('ja-JP'):'∞';
  const selected=()=>state.lenses.find(l=>l.id===state.selected);
  const sorted=()=>[...state.lenses].sort((a,b)=>a.x-b.x);
  const active=()=>state.none?[]:sorted();
  const label=(x,y,t,extra='')=>`<text x="${x}" y="${y}" text-anchor="middle" ${extra}>${t}</text>`;
  function line(x1,y1,x2,y2,color='#cb8731',dash=false,arrow=false){
    return `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${color}" stroke-width="1.8" ${dash?'stroke-dasharray="5 5" opacity=".65"':''} ${arrow?'marker-end="url(#arrow-amber)"':''}/>`;
  }
  // The flame tip is exactly 3 * HEIGHT above the axis for ray/image consistency.
  function candle(x,y,scale=1,ghost=false){
    return `<g transform="translate(${x} ${y}) scale(${scale})" ${ghost?'opacity=".5"':''}><path d="M-10 0 V-61 Q0 -67 10 -61 V0Z" fill="${ghost?'#d1c5e1':'#e4b76a'}" stroke="${ghost?'#8a729b':'#b5833d'}" stroke-width="1.2" ${ghost?'stroke-dasharray="4 3"':''}/><ellipse cy="-61" rx="10" ry="3" fill="${ghost?'#e2d9ee':'#f9dfaa'}"/><path d="M0 -62 V-70" stroke="#624637" stroke-width="1.5"/><path d="M0 -90 C-4 -80 -14 -77 -10 -68 C-6 -59 9 -60 10 -70 C12 -79 2 -82 0 -90Z" fill="${ghost?'#b9a5ce':'#ef9450'}"/><path d="M0 -80 C-7 -70 -3 -65 2 -67 C6 -69 3 -76 0 -80Z" fill="#ffe5a0"/></g>`;
  }
  function dimension(x1,x2,y,text,color='#82939a'){
    const p=X(clamp(x1,-150,150)),q=X(clamp(x2,-150,150));
    return `<path d="M${p} ${y-5} V${y+5} M${p} ${y} H${q} M${q} ${y-5} V${y+5}" fill="none" stroke="${color}"/>${label((p+q)/2,y-8,text,`style="fill:${color};font-size:13px"`)}`;
  }
  function lensLimits(lens){
    const list=sorted(),i=list.findIndex(l=>l.id===lens.id);
    return [Math.max(-100,state.objectX+5,i?list[i-1].x+8:-100),Math.min(100,i<list.length-1?list[i+1].x-8:100)];
  }
  function drawLenses(){
    const list=active(),sel=selected();
    $('lens').innerHTML=list.map(l=>{
      const chosen=l.id===state.selected,[lo,hi]=lensLimits(l),name=l.f>0?'凸レンズ':'凹レンズ';
      return `<g transform="translate(${X(l.x)} 240)" class="drag-handle lens-handle" data-drag="lens" data-id="${l.id}" tabindex="0" role="slider" aria-label="レンズ${l.id}の位置" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${l.x}"><title>${name}${l.id}：ドラッグで移動、選択して種類を変更</title><rect x="-26" y="-161" width="52" height="322" rx="10" fill="transparent"/><path d="${l.f>0?'M0 -150 Q39 0 0 150 Q-39 0 0 -150Z':'M-19 -150 Q10 0 -19 150 H19 Q-10 0 19 -150Z'}" fill="url(#glass)" stroke="${chosen?'#157e76':'#89b6b2'}" stroke-width="${chosen?2.5:1.3}"/>${label(0,-170,list.length===1?name:`${name} ${l.id}`,`style="fill:${chosen?'#157e76':'#6b7d85'}"`)}${chosen?label(0,177,'↔','style="fill:#157e76;font-size:20px"'):''}</g>`;
    }).join('');
    // Only the selected lens has focus handles, preventing overlaps in compound systems.
    $('focus-handles').innerHTML=state.none?'':[-1,1].map(sign=>`<g class="drag-handle focus-handle" data-drag="focus" data-id="${sel.id}" data-sign="${sign}" transform="translate(${X(sel.x+sign*Math.abs(sel.f))} 240)" tabindex="0" role="slider" aria-label="レンズ${sel.id}の${sign<0?'左':'右'}焦点F" aria-valuemin="10" aria-valuemax="50" aria-valuenow="${Math.abs(sel.f)}"><title>焦点Fをドラッグして焦点距離を変更</title><circle r="19" fill="transparent"/><circle r="7" fill="#e5f3ee" stroke="#157e76" stroke-width="2"/>${label(0,29,'F','style="fill:#157e76;font-size:17px;font-weight:bold"')}</g>`).join('');
  }
  function drawRays(lenses,result){
    let rays='';
    if($('show-rays').checked){
      let slopes;
      if(!lenses.length)slopes=[-.3,-.15,0,.15];
      else{
        const first=lenses[0],a=first.x-state.objectX;
        const qs=[O.HEIGHT,0];
        if(Math.abs(a-first.f)>1e-8){const q=O.HEIGHT*first.f/(first.f-a);if(Math.abs(q)<=O.APERTURE)qs.push(q);}
        // Extra rays make transmission through the second/third aperture observable.
        if(lenses.length>1)qs.push(-20,15,40);
        slopes=[...new Set(qs)].map(q=>(q-O.HEIGHT)/a);
      }
      for(const slope of slopes){
        const ray=O.trace(state.objectX,lenses,slope);
        for(let i=1;i<ray.points.length;i++){
          const p=ray.points[i-1],q=ray.points[i];rays+=line(p.x,p.y,q.x,q.y);
        }
        if(ray.blocked)continue;
        rays+=line(ray.x,ray.y,153,ray.y+ray.u*(153-ray.x),'#cb8731',false,true);
        if(result.kind==='virtual'){
          const x=Math.max(-153,result.imageX);
          rays+=line(ray.x,ray.y,x,ray.y+ray.u*(x-ray.x),'#9c829f',true);
        }
      }
    }
    $('rays').innerHTML=rays;
  }
  function drawView(result,obs){
    let svg='<defs><filter id="defocus" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs><path d="M20 110 H200" stroke="#edf1ef"/>';
    let title='';
    if(obs.status==='converging'){
      const scale=3.4+1.8*Math.min(1,O.EYE/Math.max(O.EYE,result.imageX));
      svg+=`<g filter="url(#defocus)" opacity=".85" data-blurred="true">${candle(110,80+90*scale,scale)}</g>`;title='ピンぼけ（模式図）';
    }else if(obs.status==='clear'){
      svg+=candle(110,110,obs.angle*400/90);title=obs.angle>=0?'正立':'倒立';
    }else svg+=label(110,114,'視野外','style="font-size:14px;fill:#81928e"');
    $('view').innerHTML=svg;$('view').setAttribute('aria-label',title||'視野外');$('view-title').textContent=title;
  }
  function render(){
    const lenses=active(),result=O.system(state.objectX,lenses),sel=selected();
    document.querySelectorAll('[data-mode]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.mode===(state.none?'none':sel.f>0?'convex':'concave'))));
    $('add-lens').disabled=!newLensPosition() || state.lenses.length>=4;
    $('remove-lens').hidden=state.lenses.length===1 || state.none;
    $('image-badge').textContent=state.none?'光の直進':`${lenses.length>1?`選択：レンズ${sel.id} · `:''}${result.kind==='infinity'?'像は無限遠':result.kind==='real'?'実像':'虚像'}`;
    $('formula-panel').hidden=state.none || !$('show-formula').checked;
    $('formula-title').textContent=lenses.length>1?`レンズ ${sel.id} の式`:'レンズの式';
    $('observer-panel').hidden=!$('show-view').checked;
    let axis=line(-153,0,153,0,'#b8c6cc');
    for(let x=-140;x<=140;x+=10)axis+=line(x,-1,x,1,'#c2cdd2');
    $('axis').innerHTML=axis+label(923,265,'光軸');
    drawLenses();drawRays(lenses,result);
    let img='';
    if(result.kind==='real'||result.kind==='virtual'){
      if(result.imageX>=-150 && result.imageX<=150)img=candle(X(result.imageX),240,result.m,true)+label(X(result.imageX),result.m>0?Math.max(60,Y(result.imageY)-16):Math.min(385,Y(result.imageY)+22),lenses.length>1?'最終像':result.kind==='real'?'実像':'虚像','style="fill:#9374a4"');
      else img=label(result.imageX<0?130:800,75,`${result.imageX<0?'←':'→'} 像は図の外`,'style="fill:#9374a4"');
    }
    if(result.kind==='infinity')img=label(740,75,'像は無限遠');
    $('image').innerHTML=img;
    $('candle').setAttribute('transform',`translate(${X(state.objectX)} 240)`);
    $('candle').setAttribute('aria-valuenow',state.objectX);
    $('candle').setAttribute('aria-valuemax',(sorted()[0]?.x??0)-5);
    $('candle').innerHTML=`<rect x="-28" y="-115" width="56" height="150" rx="12" fill="transparent"/>${candle(0,0)}${label(0,-104,'ろうそく','class="figure-label" style="fill:#9a7138"')}<rect x="-23" y="12" width="46" height="22" rx="11" fill="#fbefd9"/>${label(0,28,'↔','style="fill:#a87d3f;font-size:19px"')}`;
    $('observer').innerHTML=`<g transform="translate(${X(O.EYE)} 240)"><path d="M-7 0 Q9 -21 26 0 Q9 21 -7 0Z" fill="white" stroke="#667f86" stroke-width="1.8"/><ellipse cx="1" rx="5" ry="10" fill="#497e7a"/><ellipse cx="-1" rx="2" ry="5" fill="#233c43"/></g>${label(899,288,'観測者')}`;
    let measures='';
    if($('show-distances').checked){
      if(state.none)measures=dimension(state.objectX,0,413,`a = ${fmt(-state.objectX)} cm`,'#ab854b');
      else{
        const stage=result.stages.find(r=>r.id===sel.id);
        if(Number.isFinite(stage.a))measures+=dimension(sel.x-stage.a,sel.x,410,`a${lenses.length>1?sel.id:''} = ${fmt(stage.a)} cm`,'#ab854b');
        else measures+=label(X(sel.x),402,`a${sel.id} = ∞`);
        measures+=dimension(sel.x,sel.x+Math.abs(sel.f),325,`|f${lenses.length>1?sel.id:''}| = ${Math.abs(sel.f)} cm`,'#308e87');
        if(Number.isFinite(stage.b))measures+=dimension(sel.x,stage.imageX,449,`b${lenses.length>1?sel.id:''} = ${fmt(stage.b)} cm`,'#9374a4');
        for(let i=1;i<lenses.length;i++)measures+=dimension(lenses[i-1].x,lenses[i].x,375,`d = ${fmt(lenses[i].x-lenses[i-1].x)} cm`);
      }
    }
    $('measurements').innerHTML=measures;
    if($('show-view').checked)drawView(result,O.systemObservation(state.objectX,lenses,result));
  }
  // New lenses occupy a free gap; lens order is preserved during dragging.
  function newLensPosition(){
    const list=sorted(),lo=Math.max(-100,state.objectX+5),last=list[list.length-1];
    if(last.x+40<=100)return {x:last.x+40};
    const bounds=[lo-8,...list.map(l=>l.x),108];
    let best=null;
    for(let i=1;i<bounds.length;i++)if(bounds[i]-bounds[i-1]>=16 && (!best || bounds[i]-bounds[i-1]>best.gap))best={x:Math.round((bounds[i]+bounds[i-1])/2),gap:bounds[i]-bounds[i-1]};
    return best;
  }
  function move(type,id,value,sign=1){
    if(type==='candle')state.objectX=clamp(Math.round(value),-140,sorted()[0].x-5);
    else{
      const l=state.lenses.find(item=>item.id===id);if(!l)return;
      if(type==='lens'){const [lo,hi]=lensLimits(l);l.x=clamp(Math.round(value),lo,hi);}
      if(type==='focus')l.f=Math.sign(l.f)*clamp(Math.round(sign*(value-l.x)),10,50);
    }
    render();
  }
  function worldX(event){return (new DOMPoint(event.clientX,event.clientY).matrixTransform($('scene').getScreenCTM().inverse()).x-480)/3;}
  $('candle').dataset.drag='candle';
  $('scene').addEventListener('pointerdown',event=>{
    const target=event.target.closest('[data-drag]');if(!target||event.button!==0)return;
    const type=target.dataset.drag,id=Number(target.dataset.id),sign=Number(target.dataset.sign)||1;
    if(type!=='candle')state.selected=id;
    const l=selected(),anchor=type==='candle'?state.objectX:type==='lens'?l.x:l.x+sign*Math.abs(l.f);
    drag={type,id,sign,offset:worldX(event)-anchor};
    $('scene').setPointerCapture(event.pointerId);event.preventDefault();render();
  });
  $('scene').addEventListener('pointermove',event=>{if(drag)move(drag.type,drag.id,worldX(event)-drag.offset,drag.sign);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(name,()=>{drag=null;});
  $('scene').addEventListener('focusin',event=>{
    const target=event.target.closest('[data-drag]');
    if(target?.dataset.id && state.selected!==Number(target.dataset.id)){
      state.selected=Number(target.dataset.id);render();
      $('scene').querySelector(`[data-drag="${target.dataset.drag}"][data-id="${target.dataset.id}"]`)?.focus();
    }
  });
  $('scene').addEventListener('keydown',event=>{
    const t=event.target.closest('[data-drag]');if(!t || !['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const step=(event.shiftKey?10:1)*(event.key==='ArrowLeft'?-1:1),id=Number(t.dataset.id),sign=Number(t.dataset.sign)||1,type=t.dataset.drag;
    const l=state.lenses.find(item=>item.id===id),v=type==='candle'?state.objectX:type==='lens'?l.x:l.x+sign*Math.abs(l.f);
    move(type,id,v+step,sign);
    (type==='candle'?$('candle'):$('scene').querySelector(`[data-drag="${type}"][data-id="${id}"]${type==='focus'?`[data-sign="${sign}"]`:''}`))?.focus();
  });
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    state.none=btn.dataset.mode==='none';if(!state.none)selected().f=Math.abs(selected().f)*(btn.dataset.mode==='convex'?1:-1);render();
  }));
  $('add-lens').addEventListener('click',()=>{
    const pos=newLensPosition();if(!pos||state.lenses.length>=4)return;
    const l={id:state.nextId++,x:pos.x,f:selected().f};state.lenses.push(l);state.selected=l.id;state.none=false;render();
  });
  $('remove-lens').addEventListener('click',()=>{if(state.lenses.length<=1)return;state.lenses=state.lenses.filter(l=>l.id!==state.selected);state.selected=state.lenses[0].id;render();});
  document.querySelectorAll('input[type=checkbox]').forEach(el=>el.addEventListener('change',render));
  $('reset').addEventListener('click',()=>{state=initial();document.querySelectorAll('input[type=checkbox]').forEach(el=>el.checked=el.defaultChecked);render();});
  render();
})();
