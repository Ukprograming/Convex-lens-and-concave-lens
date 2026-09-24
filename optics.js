/* Pure thin-lens model. Coordinates: x to the right, y upwards, centimetres. */
(function(root){
  'use strict';
  const HEIGHT=30, EYE=140, APERTURE=50;
  function calculate(mode,a,magnitude){
    if(mode==='none') return {f:null,b:null,m:null,kind:'direct'};
    const f=mode==='convex'?magnitude:-magnitude;
    if(Math.abs(a-f)<1e-9) return {f,b:Infinity,m:null,kind:'infinity'};
    const b=a*f/(a-f),m=-b/a;
    return {f,b,m,kind:b>0?'real':'virtual'};
  }
  function eyeRay(mode,a,f,height=HEIGHT,pupilY=0){
    if(mode==='none'){
      const slope=(pupilY-height)/(EYE+a);
      return {q:height+a*slope,slope,visible:true};
    }
    const denominator=1+EYE/a-EYE/f;
    if(Math.abs(denominator)<1e-9) return {q:null,slope:null,visible:false};
    const q=(pupilY+EYE*height/a)/denominator;
    return {q,slope:(pupilY-q)/EYE,visible:Math.abs(q)<=APERTURE};
  }
  function observation(mode,a,result){
    const ray=eyeRay(mode,a,result.f);
    if(result.kind==='real' && result.b>=EYE-1e-8) return {status:'converging',ray,angle:null};
    if(!ray.visible) return {status:'blocked',ray,angle:null};
    return {status:'clear',ray,angle:Math.atan(-ray.slope)};
  }
  // Paraxial ray transfer through each lens, including virtual intermediate objects.
  function trace(objectX,lenses,slope,height=HEIGHT,stopAtAperture=true){
    let x=objectX,y=height,u=slope;
    const points=[{x,y}];
    for(const lens of [...lenses].sort((a,b)=>a.x-b.x)){
      y+=u*(lens.x-x);x=lens.x;points.push({x,y});
      if(stopAtAperture && Math.abs(y)>APERTURE) return {points,x,y,u,blocked:true};
      u-=y/lens.f;
    }
    return {points,x,y,u,blocked:false};
  }
  function system(objectX,lenses){
    const sorted=[...lenses].sort((a,b)=>a.x-b.x);
    if(!sorted.length)return {kind:'direct',imageX:objectX,imageY:HEIGHT,m:1,stages:[],lastX:objectX};
    const stages=[];
    for(let i=0;i<sorted.length;i++){
      const subset=sorted.slice(0,i+1),r0=trace(objectX,subset,0,HEIGHT,false),r1=trace(objectX,subset,1,HEIGHT,false);
      const B=r1.y-r0.y,D=r1.u-r0.u,lastX=sorted[i].x;
      const b=Math.abs(D)<1e-9?Infinity:-B/D;
      const imageY=Number.isFinite(b)?r0.y+b*r0.u:null;
      const previous=i?stages[i-1].imageX:objectX;
      stages.push({id:sorted[i].id,a:Number.isFinite(previous)?lastX-previous:Infinity,b,
        f:sorted[i].f,imageX:lastX+b,imageY,m:imageY===null?null:imageY/HEIGHT,
        kind:!Number.isFinite(b)?'infinity':b>=0?'real':'virtual',lastX});
    }
    return {...stages[stages.length-1],stages};
  }
  function systemObservation(objectX,lenses,result){
    const r0=trace(objectX,lenses,0,HEIGHT,false),r1=trace(objectX,lenses,1,HEIGHT,false);
    const distance=EYE-r0.x;
    const base=r0.y+distance*r0.u,coefficient=r1.y+distance*r1.u-base;
    if(result.kind==='real' && result.imageX>=EYE-1e-8)return {status:'converging',angle:null};
    if(Math.abs(coefficient)<1e-9)return {status:'blocked',angle:null};
    const ray=trace(objectX,lenses,-base/coefficient);
    return {status:ray.blocked?'blocked':'clear',angle:Math.atan(-ray.u)};
  }
  const api={HEIGHT,EYE,APERTURE,calculate,eyeRay,observation,trace,system,systemObservation};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.Optics=api;
})(typeof window!=='undefined'?window:globalThis);
