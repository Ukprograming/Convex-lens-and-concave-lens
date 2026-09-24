const assert=require('node:assert/strict');
const test=require('node:test');
const O=require('../optics.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
test('convex: 2f, outside 2f, inside focal length and at focus',()=>{
  let r=O.calculate('convex',40,20);close(r.b,40);close(r.m,-1);
  r=O.calculate('convex',60,20);close(r.b,30);close(r.m,-.5);
  r=O.calculate('convex',10,20);close(r.b,-20);close(r.m,2);
  r=O.calculate('convex',20,20);assert.equal(r.kind,'infinity');assert.equal(r.b,Infinity);
});
test('concave: virtual, upright and reduced across all supported inputs',()=>{
  for(let a=5;a<=140;a++)for(let f=10;f<=50;f++){
    const r=O.calculate('concave',a,f);assert.ok(r.b<0 && r.b>-f);assert.ok(r.m>0 && r.m<1);
    close(1/a+1/r.b,1/r.f);
  }
});
test('rays through any lens height meet at the calculated image',()=>{
  for(const mode of ['convex','concave'])for(const a of [5,10,19,21,40,100,140]){
    const r=O.calculate(mode,a,20);
    for(const q of [-40,0,18,40])close(q+((q-O.HEIGHT)/a-q/r.f)*r.b,O.HEIGHT*r.m);
  }
});
test('observer rays reach the pupil and obey refraction',()=>{
  for(const mode of ['convex','concave','none'])for(const a of [5,19,20,21,40,140]){
    const r=O.calculate(mode,a,20);
    for(const pupil of [-1.3,0,1.3]){
      const ray=O.eyeRay(mode,a,r.f,O.HEIGHT,pupil);if(ray.q===null)continue;
      close(ray.q+ray.slope*O.EYE,pupil);
      close(ray.slope,(ray.q-O.HEIGHT)/a-(mode==='none'?0:ray.q/r.f));
    }
  }
});
test('no lens: straight light, upright view, smaller angular size with distance',()=>{
  const near=O.observation('none',5,O.calculate('none',5,20));
  const far=O.observation('none',140,O.calculate('none',140,20));
  assert.ok(near.angle>far.angle && far.angle>0);assert.equal(near.status,'clear');
});
test('observer at/before real image, blocked rays, infinity',()=>{
  assert.equal(O.observation('convex',21,O.calculate('convex',21,20)).status,'converging');
  assert.equal(O.observation('convex',70/3,O.calculate('convex',70/3,20)).status,'converging');
  assert.equal(O.observation('convex',24,O.calculate('convex',24,20)).status,'blocked');
  const r=O.calculate('convex',20,20), view=O.observation('convex',20,r);
  assert.equal(view.status,'blocked');close(view.ray.slope,-O.HEIGHT/20);
});

test('system: translated single lens agrees with lens equation',()=>{
  for(const x of [-20,0,40])for(const f of [-30,20]){
    const r=O.system(-60,[{id:1,x,f}]),single=O.calculate(f>0?'convex':'concave',x+60,Math.abs(f));
    close(r.b,single.b);close(r.m,single.m);close(r.imageX,x+single.b);
  }
});
test('two lenses: real intermediate image becomes virtual final image',()=>{
  const r=O.system(-60,[{id:1,x:0,f:20},{id:2,x:40,f:20}]);
  close(r.stages[0].imageX,30);close(r.stages[1].a,10);
  close(r.b,-20);close(r.imageX,20);close(r.m,-1);
});
test('second lens intercepts converging rays: virtual object has negative a',()=>{
  const r=O.system(-60,[{id:1,x:0,f:20},{id:2,x:20,f:20}]);
  close(r.stages[1].a,-10);close(r.b,20/3);close(r.imageX,80/3);close(r.m,-1/3);
});
test('infinity intermediate and final images are handled without NaN',()=>{
  let r=O.system(-20,[{id:1,x:0,f:20},{id:2,x:40,f:20}]);
  assert.equal(r.stages[0].kind,'infinity');close(r.b,20);close(r.m,-1);
  r=O.system(-60,[{id:1,x:0,f:20},{id:2,x:50,f:20}]);
  assert.equal(r.kind,'infinity');assert.equal(r.m,null);
});
test('trace: continuous at lenses, follows refraction, stops at aperture',()=>{
  const lenses=[{id:1,x:0,f:20},{id:2,x:40,f:-30},{id:3,x:80,f:25}];
  const ray=O.trace(-60,lenses,-.3,O.HEIGHT,false);
  let x=-60,y=O.HEIGHT,u=-.3;
  for(let i=0;i<lenses.length;i++){
    y+=u*(lenses[i].x-x);x=lenses[i].x;close(ray.points[i+1].y,y);u-=y/lenses[i].f;
  }
  close(ray.u,u);
  const blocked=O.trace(-60,lenses,2);assert.equal(blocked.blocked,true);assert.equal(blocked.points.length,2);
});
test('system observer agrees with single lens, including defocus',()=>{
  for(const a of [10,20,21,24,60,100])for(const f of [-20,20]){
    const lenses=[{id:1,x:0,f}],r=O.system(-a,lenses),obs=O.systemObservation(-a,lenses,r);
    const old=O.observation(f>0?'convex':'concave',a,O.calculate(f>0?'convex':'concave',a,Math.abs(f)));
    assert.equal(obs.status,old.status);if(obs.status==='clear')close(obs.angle,old.angle);
  }
});

test('three mixed lenses: final image and total magnification, independent of array order',()=>{
  const r=O.system(-60,[{id:3,x:80,f:25},{id:1,x:0,f:20},{id:2,x:40,f:-30}]);
  close(r.stages[1].imageX,32.5);close(r.b,475/9);close(r.imageX,1195/9);close(r.m,5/12);
  assert.equal(r.kind,'real');
});
