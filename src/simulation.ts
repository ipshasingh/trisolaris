// Migrated from the original vanilla simulator. Algorithms and presentation behavior intentionally preserved.
// @ts-nocheck

/* Run statistics: records what happens during a simulation so report.js can explain it. */
let stats;
let lastChangeAt = Date.now();          // wall-clock time of the last system change (add/remove/edit/reset)

function totalEnergy(){                                   // kinetic + softened gravitational potential
  const { G, soft } = getConsts(); let e = 0;
  bodies.forEach((a, i) => {
    e += .5*a.mass*(a.vx*a.vx + a.vy*a.vy);
    for(let j = i+1; j < bodies.length; j++){ const b = bodies[j]; e -= G*a.mass*b.mass/Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + soft*soft); }
  });
  return e;
}
function resetStats(){
  stats = { steps:0, events:[], pairs:{}, per:{}, snap:null, removedAfterSnap:false, editedAfterSnap:false, edits:0 };
  stats.e0 = totalEnergy();
  lastChangeAt = Date.now();
}
function logEvent(msg){ stats.events.push({ t, msg }); lastChangeAt = Date.now(); }
function noteEdit(){ stats.edits++; if(stats.snap) stats.editedAfterSnap = true; stats.e0 = totalEnergy(); lastChangeAt = Date.now(); }

function recordStats(){                                   // sampled every 15 integration steps
  if(++stats.steps % 15) return;
  const { G, soft } = getConsts();
  for(let i = 0; i < bodies.length; i++) for(let j = i+1; j < bodies.length; j++){
    const a = bodies[i], b = bodies[j], ss = a.type === 'star' && b.type === 'star';
    if(!ss && a.type !== 'star' && b.type !== 'star') continue;
    const d = Math.hypot(a.x-b.x, a.y-b.y), thr = ss ? .45 : .4, key = a.uid + '-' + b.uid;
    const p = stats.pairs[key] || (stats.pairs[key] = { a:a.name, b:b.name, ss, min:Infinity, tmin:0, n:0, inside:false });
    if(d < p.min){ p.min = d; p.tmin = t; }
    if(d < thr && !p.inside){ p.inside = true; p.n++; } else if(d > thr*1.5) p.inside = false;
  }
  bodies.forEach(b => {
    const s = stats.per[b.uid] || (stats.per[b.uid] = { cl:{}, era:{}, life:{}, vmax:0, imin:Infinity, imax:0, share:0, target:'' });
    s.vmax = Math.max(s.vmax, Math.hypot(b.vx, b.vy));
    if(b.type === 'planet'){
      const e = classifyEnvironment(b);
      if(e.climateLabel !== '–'){
        s.cl[e.climateLabel] = (s.cl[e.climateLabel] || 0) + 1; s.era[e.era] = (s.era[e.era] || 0) + 1;
        const l = e.life.split(' ')[0]; s.life[l] = (s.life[l] || 0) + 1;
      }
      const h = b.insoHist, x = h && h[h.length-1];
      if(x !== undefined){ s.imin = Math.min(s.imin, x); s.imax = Math.max(s.imax, x); }
    }
    if(b.addedAt !== undefined) bodies.forEach((o, k) => {  // peak share of the pull on others that this added body supplied
      if(o === b) return;
      const share = Math.min(1, G*b.mass/((o.x-b.x)**2 + (o.y-b.y)**2 + soft*soft)/(lastAcc[k] || 1e-9));
      if(share > s.share){ s.share = share; s.target = o.name; }
    });
  });
}


/* Physics core: N-body state, gravity, RK4 integrator, planet environment model. No dependencies. */
const DEFAULTS = [
  {name:'Sun 1', mass:1.0, x: 1.0,  y: 0.0,  vx: 0.00, vy: 0.55, type:'star', color:'#e8a33d'},
  {name:'Sun 2', mass:0.9, x:-0.5,  y: 0.87, vx:-0.48, vy:-0.27, type:'star', color:'#d1495b'},
  {name:'Sun 3', mass:1.1, x:-0.5,  y:-0.87, vx: 0.48, vy:-0.27, type:'star', color:'#3f8efc'},
  {name:'Planet', mass:0.0005, x: 2.0, y: 0.3, vx:-0.15, vy: 0.9, type:'planet', color:'#5ec98f'},
];
let bodies, trails, t, running=false, lastAcc=[], uidCounter=0;

function nextColor(){ return `hsl(${(bodies.length*137.5)%360},70%,60%)`; }
function warmColor(){ return `hsl(${20 + Math.random()*40},90%,62%)`; }
function defaultColorFor(type){ return type==='moon' ? '#c9c9d4' : type==='planet' ? '#5ec98f' : type==='star' ? warmColor() : nextColor(); }
function addBody(preset){
  const nb = Object.assign({name:'Body '+(bodies.length+1), mass:0.3, x:0, y:0, vx:0, vy:0, type:'other', color:defaultColorFor((preset&&preset.type)||'other'), uid:uidCounter++}, preset);
  if(!stats.snap) stats.snap = {t, bodies: bodies.map(b=>({uid:b.uid,name:b.name,x:b.x,y:b.y,vx:b.vx,vy:b.vy,mass:b.mass}))};
  nb.addedAt = t; logEvent(`Added ${nb.type} **${nb.name}** (mass ${nb.mass})`);
  bodies.push(nb); trails.push([]); lastAcc.push(0); stats.e0 = totalEnergy();
}
function removeBody(i){
  if(bodies[i].addedAt === undefined) return;   // protect the default Star/Planet/Moon system
  logEvent(`Removed ${bodies[i].type} **${bodies[i].name}**`); if(stats.snap) stats.removedAfterSnap = true;
  bodies.splice(i,1); trails.splice(i,1); lastAcc.splice(i,1); stats.e0 = totalEnergy();
}
function addMoon(){
  const planet = bodies.find(b=>b.type==='planet') || bodies[bodies.length-1];
  addBody({name:'Moon '+(bodies.filter(b=>b.type==='moon').length+1), mass:0.00005, x:planet.x+0.12, y:planet.y, vx:planet.vx, vy:planet.vy+0.9, type:'moon'});
}
function addPlanet(){
  const n = bodies.filter(b=>b.type==='planet').length + 1;
  const ang = Math.random()*Math.PI*2, r = 1.6+Math.random()*1.2;
  addBody({name:'Planet '+n, mass:0.0005, x:r*Math.cos(ang), y:r*Math.sin(ang), vx:-Math.sin(ang)*0.8, vy:Math.cos(ang)*0.8, type:'planet', color:nextColor(), insoHist:[]});
}

function resetState(){
  bodies = DEFAULTS.map(b=>({...b, uid:uidCounter++, insoHist: b.type==='planet' ? [] : undefined}));
  trails = bodies.map(()=>[]);
  lastAcc = bodies.map(()=>0);
  t = 0;
  resetStats();
}
let controls = { G: 1, soft: 0.05, dt: 0.003 };

function getConsts(){ return controls; }

function accelerations(pos, mass, G, soft){
  const n = pos.length, acc = pos.map(()=>[0,0]);
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){
      if(i===j) continue;
      const dx = pos[j][0]-pos[i][0], dy = pos[j][1]-pos[i][1];
      const d2 = dx*dx+dy*dy+soft*soft, d = Math.sqrt(d2), d3 = d2*d;
      acc[i][0] += G*mass[j]*dx/d3;
      acc[i][1] += G*mass[j]*dy/d3;
    }
  }
  return acc;
}

function rk4Step(pos, vel, mass, dt, G, soft){
  const deriv = (p,v) => [v, accelerations(p, mass, G, soft)];
  const add = (a,b,s) => a.map((p,i)=>[p[0]+b[i][0]*s, p[1]+b[i][1]*s]);

  const [k1p,k1v] = deriv(pos, vel);
  const [k2p,k2v] = deriv(add(pos,k1p,dt/2), add(vel,k1v,dt/2));
  const [k3p,k3v] = deriv(add(pos,k2p,dt/2), add(vel,k2v,dt/2));
  const [k4p,k4v] = deriv(add(pos,k3p,dt),   add(vel,k3v,dt));

  const newPos = pos.map((p,i)=>[
    p[0] + dt/6*(k1p[i][0]+2*k2p[i][0]+2*k3p[i][0]+k4p[i][0]),
    p[1] + dt/6*(k1p[i][1]+2*k2p[i][1]+2*k3p[i][1]+k4p[i][1])]);
  const newVel = vel.map((v,i)=>[
    v[0] + dt/6*(k1v[i][0]+2*k2v[i][0]+2*k3v[i][0]+k4v[i][0]),
    v[1] + dt/6*(k1v[i][1]+2*k2v[i][1]+2*k3v[i][1]+k4v[i][1])]);
  return [newPos, newVel];
}

function step(){
  const {G, soft, dt} = getConsts();
  const pos = bodies.map(b=>[b.x,b.y]);
  const vel = bodies.map(b=>[b.vx,b.vy]);
  const mass = bodies.map(b=>b.mass);
  const [newPos, newVel] = rk4Step(pos, vel, mass, dt, G, soft);
  lastAcc = accelerations(pos, mass, G, soft).map(a=>Math.hypot(a[0],a[1]));
  bodies.forEach((b,i)=>{ b.x=newPos[i][0]; b.y=newPos[i][1]; b.vx=newVel[i][0]; b.vy=newVel[i][1]; });
  trails.forEach((tr,i)=>{ tr.push([bodies[i].x,bodies[i].y,Math.hypot(bodies[i].vx,bodies[i].vy)]); if(tr.length>900) tr.shift(); });

  bodies.forEach(p=>{
    if(p.type!=='planet') return;
    if(!p.insoHist) p.insoHist=[];
    let inso = 0;
    bodies.forEach(b=>{ if(b.type==='star'){ const dx=b.x-p.x, dy=b.y-p.y; inso += b.mass/(dx*dx+dy*dy+0.02); } });
    p.insoHist.push(inso); if(p.insoHist.length>300) p.insoHist.shift();
  });
  t += dt;
  recordStats();
}

function classifyEnvironment(planet){
  const hist = planet && planet.insoHist;
  if(!planet || !hist || hist.length<5) return {inso:0, era:'–', climateLabel:'–', climateColor:'#8d90ab', atmo:'–', life:'–', water:'–', nearest:'–', grav:0};
  const mean = hist.reduce((a,b)=>a+b,0)/hist.length;
  const variance = hist.reduce((a,b)=>a+(b-mean)**2,0)/hist.length;
  const cv = Math.sqrt(variance)/(mean||1e-6);
  const era = cv > 0.12 ? 'Chaotic Era' : 'Stable Era';
  let climateLabel, climateColor;
  if(mean<0.3){climateLabel='Frozen';climateColor='#3fa7fc';}
  else if(mean<1.8){climateLabel='Temperate';climateColor='#5ec98f';}
  else if(mean<4){climateLabel='Scorching';climateColor='#e8734d';}
  else {climateLabel='Boiling';climateColor='#ff3b3b';}
  const atmo = climateLabel==='Boiling' ? 'Stripped away' : climateLabel==='Frozen' ? 'Frozen solid' : 'Stable';
  const water = climateLabel==='Frozen' ? 'Ice' : climateLabel==='Temperate' ? 'Liquid' : climateLabel==='Scorching' ? 'Vapor — boiling off' : 'Gone — vented to space';
  let life;
  if(era==='Chaotic Era') life='Dormant — dehydrated 💧';
  else if(climateLabel==='Temperate') life='Flourishing 🌱';
  else life='Extinguished ⚠️';
  let nearest='', nd=Infinity;
  bodies.forEach(b=>{ if(b.type==='star'){ const d=Math.hypot(b.x-planet.x,b.y-planet.y); if(d<nd){nd=d;nearest=b.name;} } });
  const gi = bodies.indexOf(planet);
  const grav = lastAcc[gi]!==undefined ? lastAcc[gi] : 0;
  return {inso:mean, era, climateLabel, climateColor, atmo, life, water, nearest, nd, grav};
}



/* Canvas renderer: full-page space view, glowing suns, physics vectors, gravity ties, trails. */
let cv; let ctx;

const view = { vel:true, grav:true, trails:true, labels:true };
let W = 0, H = 0, DPR = 1, stars = [], cam = { x:0, y:0, s:100 }, envMap = {};

function resize(){
  if(!cv) return;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const st = cv.parentElement; W = st.clientWidth; H = st.clientHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  stars = Array.from({length:240}, () => ({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.3+.3, a:Math.random()*.6+.15, p:Math.random()*6 }));
}
let lightTheme = false;
const isLight = () => lightTheme;


function rgba(c, a){
  if(c[0] === '#'){ const n = parseInt(c.slice(1), 16); return `rgba(${n>>16},${n>>8&255},${n&255},${a})`; }
  return c.replace('hsl(', 'hsla(').replace(')', `,${a})`);
}

function fitCamera(){
  if(!bodies.length) return;
  let sx = 0, sy = 0, sm = 0;
  bodies.forEach(b => { const m = b.type === 'star' ? b.mass : 1e-4; sx += b.x*m; sy += b.y*m; sm += m; });
  const cx = sx/sm, cy = sy/sm; let ext = 2.4;
  bodies.forEach(b => { ext = Math.max(ext, Math.hypot(b.x-cx, b.y-cy) * 1.3); });
  const s = Math.min(W, H) / 2 / ext;
  cam.x += (cx-cam.x)*.08; cam.y += (cy-cam.y)*.08; cam.s += (s-cam.s)*.05;
}

function arrow(x0, y0, dx, dy, color, w){
  const L = Math.hypot(dx, dy); if(L < 3) return;
  const ux = dx/L, uy = dy/L, x1 = x0+dx, y1 = y0+dy;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1-ux*10-uy*5, y1-uy*10+ux*5); ctx.lineTo(x1-ux*10+uy*5, y1-uy*10-ux*5);
  ctx.closePath(); ctx.fill();
}

function drawStar(b, x, y, tm){
  const L = isLight(), r = 10 + 8*Math.cbrt(b.mass), pulse = 1 + .07*Math.sin(tm/520 + b.uid*2), R = r*8*pulse;
  ctx.globalCompositeOperation = L ? 'source-over' : 'lighter';
  let g = ctx.createRadialGradient(x, y, r*.4, x, y, R);            // corona
  if(L){ g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.25, 'rgba(110,130,200,.3)'); g.addColorStop(1, 'rgba(110,130,200,0)'); }
  else { g.addColorStop(0, rgba(b.color, .55)); g.addColorStop(.3, rgba(b.color, .2)); g.addColorStop(1, rgba(b.color, 0)); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.rotate(tm/5000 + b.uid);      // slow rotating rays
  ctx.strokeStyle = L ? 'rgba(70,90,150,.4)' : rgba(b.color, .3); ctx.lineWidth = 1.3;
  for(let k = 0; k < 14; k++){ ctx.rotate(Math.PI*2/14); ctx.beginPath(); ctx.moveTo(r*1.3, 0); ctx.lineTo(r*(3.4 + (k%2)*1.6)*pulse, 0); ctx.stroke(); }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(x, y, 0, x, y, r);                    // hot white core
  g.addColorStop(0, '#fff'); g.addColorStop(.6, '#fff'); g.addColorStop(1, L ? '#dfe6fb' : rgba(b.color, .9));
  ctx.fillStyle = g; ctx.shadowColor = L ? 'rgba(60,80,150,.85)' : b.color; ctx.shadowBlur = 26;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = L ? 'rgba(50,70,140,.8)' : rgba(b.color, .6); ctx.lineWidth = 1.6;   // highlight ring
  ctx.beginPath(); ctx.arc(x, y, r*1.75, 0, 7); ctx.stroke();
  return r*1.75;
}

function drawPlanet(b, x, y, env){
  const ac = env ? env.climateColor : b.color, r = 6;                // body stays green; atmosphere shows climate
  const g = ctx.createRadialGradient(x, y, r*.5, x, y, r*3.2);
  g.addColorStop(0, rgba(ac, env && env.atmo === 'Stripped away' ? .12 : .45)); g.addColorStop(1, rgba(ac, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r*3.2, 0, 7); ctx.fill();
  ctx.fillStyle = b.color; ctx.shadowColor = ac; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(ac, .8); ctx.lineWidth = 1.6;
  if(env && env.atmo === 'Stripped away') ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.arc(x, y, r*1.6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  return r*1.6;
}

function draw(tm){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const L = isLight();
  const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H)*.7);
  bg.addColorStop(0, L ? '#f1f4fb' : '#0b0d1a'); bg.addColorStop(1, L ? '#bfcbe3' : '#03040a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = L ? '#4a5a8a' : '#fff';
  stars.forEach(s => { ctx.globalAlpha = s.a*(L ? .4 : 1)*(.65 + .35*Math.sin(tm/1100 + s.p)); ctx.fillRect(s.x, s.y, s.r, s.r); });
  ctx.globalAlpha = 1;

  fitCamera();
  const X = x => W/2 + (x-cam.x)*cam.s, Y = y => H/2 - (y-cam.y)*cam.s;
  const { G, soft } = getConsts();
  const mass = bodies.map(b => b.mass), acc = accelerations(bodies.map(b => [b.x, b.y]), mass, G, soft);

  if(view.trails){                                                    // trails: brighter = newer, thicker = faster
    ctx.lineCap = ctx.lineJoin = 'round';
    trails.forEach((tr, i) => {
      const b = bodies[i], n = tr.length; if(!b) return;
      for(let k = 3; k < n; k += 3){
        const f = k/n;
        ctx.globalAlpha = f*f*.9; ctx.strokeStyle = (L && b.type === 'star') ? '#3a4a80' : b.color;
        ctx.lineWidth = (b.type === 'star' ? 1.5 : 1) + Math.min(2.6, tr[k][2]*1.7)*f;
        ctx.beginPath(); ctx.moveTo(X(tr[k-3][0]), Y(tr[k-3][1]));
        for(let j = k-2; j <= k; j++) ctx.lineTo(X(tr[j][0]), Y(tr[j][1]));
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }

  if(view.grav){                                                      // pairwise gravity ties
    ctx.setLineDash([3, 7]); ctx.lineDashOffset = -tm/60;
    for(let i = 0; i < bodies.length; i++) for(let j = i+1; j < bodies.length; j++){
      const dx = bodies[j].x-bodies[i].x, dy = bodies[j].y-bodies[i].y;
      const pull = G*Math.max(mass[i], mass[j]) / (dx*dx + dy*dy + soft*soft), a = Math.min(1, pull/1.2);
      if(a < .02) continue;
      ctx.strokeStyle = `rgba(255,170,90,${.1 + a*.5})`; ctx.lineWidth = .6 + a*2.6;
      ctx.beginPath(); ctx.moveTo(X(bodies[i].x), Y(bodies[i].y)); ctx.lineTo(X(bodies[j].x), Y(bodies[j].y)); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  envMap = {};
  bodies.forEach(b => { if(b.type === 'planet') envMap[b.uid] = classifyEnvironment(b); });
  const radii = [];
  bodies.forEach((b, i) => {                                          // planets/moons first, suns on top
    if(b.type === 'star') return;
    const x = X(b.x), y = Y(b.y);
    if(b.type === 'planet') radii[i] = drawPlanet(b, x, y, envMap[b.uid]);
    else { const r = b.type === 'moon' ? 3.5 : 5; ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0; radii[i] = r*1.6; }
  });
  bodies.forEach((b, i) => { if(b.type === 'star') radii[i] = drawStar(b, X(b.x), Y(b.y), tm); });

  bodies.forEach((b, i) => {                                          // vectors + labels
    const x = X(b.x), y = Y(b.y), v = Math.hypot(b.vx, b.vy), a = Math.hypot(acc[i][0], acc[i][1]);
    if(view.vel && v > 1e-4){ const L = Math.min(150, 10 + v*95); arrow(x, y, b.vx/v*L, -b.vy/v*L, (L ? '#16994f' : 'rgba(110,231,160,.95)'), 1.8); }
    if(view.grav && a > 1e-4){ const L = Math.min(120, 26*Math.log10(1 + a*8)); arrow(x, y, acc[i][0]/a*L, -acc[i][1]/a*L, (L ? '#d9560c' : 'rgba(255,150,70,.95)'), 2.2); }
    if(view.labels){
      ctx.font = '600 12px "JetBrains Mono", monospace'; ctx.fillStyle = L ? 'rgba(25,32,60,.95)' : 'rgba(231,230,240,.92)';
      ctx.fillText(b.name, x + radii[i] + 6, y - 4);
      ctx.font = '11px "JetBrains Mono", monospace'; ctx.fillStyle = L ? 'rgba(70,78,110,.95)' : 'rgba(146,149,176,.95)';
      ctx.fillText(`v ${v.toFixed(2)}  a ${a.toFixed(2)}`, x + radii[i] + 6, y + 10);
    }
  });
}


/* Report generator: turns run statistics + live state into an explanatory Markdown report. */
let lastMD = '';
const f = (x, n = 2) => Number(x).toFixed(n);

function escaping(b){                                     // unbound relative to the stars (or the other stars, for a star)
  const ref = bodies.filter(o => o !== b && o.type === 'star'); if(!ref.length) return false;
  let M = 0, cx = 0, cy = 0, vx = 0, vy = 0;
  ref.forEach(o => { M += o.mass; cx += o.x*o.mass; cy += o.y*o.mass; vx += o.vx*o.mass; vy += o.vy*o.mass; });
  cx /= M; cy /= M; vx /= M; vy /= M;
  const d = Math.hypot(b.x-cx, b.y-cy), v2 = (b.vx-vx)**2 + (b.vy-vy)**2;
  return d > 4 && .5*v2 - getConsts().G*M/d > 0;
}
function pullBreakdown(b){                                // who pulls on b, as a share of the total (scalar) pull
  const { G, soft } = getConsts();
  const parts = bodies.filter(o => o !== b).map(o => ({ name:o.name, a:G*o.mass/((o.x-b.x)**2 + (o.y-b.y)**2 + soft*soft) }));
  const s = parts.reduce((x, p) => x + p.a, 0) || 1;
  return parts.sort((p, q) => q.a - p.a).map(p => ({ name:p.name, share:p.a/s*100 }));
}
function estimateChaos(){                                 // shadow run with a 1e-7 nudge; slope of ln(separation) = Lyapunov exponent
  const { G, soft, dt } = getConsts(), mass = bodies.map(b => b.mass);
  let pa = bodies.map(b => [b.x, b.y]), va = bodies.map(b => [b.vx, b.vy]);
  let pb = pa.map(p => [p[0] + 1e-7, p[1]]), vb = va.map(v => [v[0], v[1]]);
  const pts = [];
  for(let i = 1; i <= 6000; i++){
    [pa, va] = rk4Step(pa, va, mass, dt, G, soft); [pb, vb] = rk4Step(pb, vb, mass, dt, G, soft);
    if(i % 50 === 0){
      let s = 0; for(let k = 0; k < pa.length; k++) s += (pa[k][0]-pb[k][0])**2 + (pa[k][1]-pb[k][1])**2;
      const sep = Math.sqrt(s); if(sep > 0 && sep < 1e-2) pts.push([i*dt, Math.log(sep)]);
    }
  }
  if(pts.length < 4) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0)/n, my = pts.reduce((a, p) => a + p[1], 0)/n;
  const lam = pts.reduce((a, p) => a + (p[0]-mx)*(p[1]-my), 0) / (pts.reduce((a, p) => a + (p[0]-mx)**2, 0) || 1);
  return { lambda:lam, horizon:lam > 0 ? Math.log(1e7)/lam : Infinity };
}
function counterfactual(){                                // re-run from just before the first addition, without any additions
  if(!stats.snap || stats.removedAfterSnap || stats.editedAfterSnap) return null;
  const { G, soft, dt } = getConsts(), n = Math.min(60000, Math.round((t - stats.snap.t)/dt)); if(n < 1) return null;
  const mass = stats.snap.bodies.map(b => b.mass);
  let pos = stats.snap.bodies.map(b => [b.x, b.y]), vel = stats.snap.bodies.map(b => [b.vx, b.vy]);
  for(let i = 0; i < n; i++) [pos, vel] = rk4Step(pos, vel, mass, dt, G, soft);
  return stats.snap.bodies.map((b, i) => { const c = bodies.find(x => x.uid === b.uid); return c ? { name:b.name, dev:Math.hypot(c.x-pos[i][0], c.y-pos[i][1]) } : null; }).filter(Boolean);
}

function planetSection(p){
  const e = classifyEnvironment(p), s = stats.per[p.uid] || { cl:{}, era:{}, life:{}, imin:Infinity, imax:0 };
  const tot = o => Object.values(o).reduce((a, b) => a + b, 0) || 1;
  const mix = o => Object.entries(o).sort((a, b) => b[1]-a[1]).map(([k, v]) => `${k} ${f(v/tot(o)*100, 0)}%`).join(', ') || 'no data yet';
  const h = p.insoHist || [], mean = h.reduce((a, b) => a + b, 0)/(h.length || 1);
  const cv = mean ? Math.sqrt(h.reduce((a, b) => a + (b-mean)**2, 0)/(h.length || 1))/mean : 0;
  const near = Object.values(stats.pairs).filter(q => q.a === p.name || q.b === p.name).reduce((m, q) => q.min < m.min ? q : m, { min:Infinity });
  const out = [`### ${p.name}`, '', '| Property | Value |', '| --- | --- |',
    `| Climate now | ${e.climateLabel} |`, `| Era | ${e.era} |`, `| Water | ${e.water} |`, `| Atmosphere | ${e.atmo} |`, `| Life | ${e.life.split(' ')[0]} |`,
    `| Light input (recent mean) | ${f(e.inso)} |`, `| Light input range over the run | ${isFinite(s.imin) ? f(s.imin) + ' to ' + f(s.imax) : 'n/a'} |`,
    `| Net gravitational pull | ${f(e.grav)} |`, `| Nearest sun | ${e.nearest} at distance ${f(e.nd || 0)} |`,
    `| Closest approach to any sun | ${near.min < Infinity ? f(near.min) + ' (' + (near.a === p.name ? near.b : near.a) + ', t = ' + f(near.tmin) + ')' : 'n/a'} |`, '',
    `- **Time in each climate:** ${mix(s.cl)}`, `- **Time in each era:** ${mix(s.era)}`, `- **Life status over time:** ${mix(s.life)}`, ''];
  if(escaping(p)) out.push('- **Why:** it has been flung out of the star system (positive energy relative to the suns and far away). With no sun it will freeze and lose its water and atmosphere to space.');
  else {
    out.push((s.era['Chaotic Era'] || 0)/tot(s.era) > .5
      ? `- **Why:** its light input varies by about ${f(cv*100, 0)}% because it keeps being pulled between suns. There is no stable year or season, so life can only survive by going dormant (dehydration), the strategy of the Trisolarans in the novel.`
      : `- **Why:** its light input is fairly steady (variation about ${f(cv*100, 0)}%), so its orbit has effectively settled around one sun and its seasons are predictable.`);
    const top = Object.entries(s.cl).sort((a, b) => b[1]-a[1])[0];
    if(top) out.push('- **Climate:** ' + ({ Frozen:'it spends most of its time far from the suns, so light is scarce and water stays frozen.', Temperate:'on average it sits in the temperate band where liquid water can exist.', Scorching:'it is often too close to the suns: heat pushes water into vapour and the atmosphere begins to thin.', Boiling:'it receives extreme light: oceans boil away and the atmosphere is stripped.' }[top[0]]));
    if(near.min < .5) out.push(`- **Close pass:** it came within ${f(near.min)} of ${near.a === p.name ? near.b : near.a}, where light flux is roughly ${f(1/near.min**2, 1)} times the flux at distance 1 (for a unit-mass sun). Such passes cause sharp heat spikes and strong tidal tugs.`);
  }
  return out.concat(['']);
}

function buildReportMD(){
  const { G, soft, dt } = getConsts();
  const stars = bodies.filter(b => b.type === 'star'), planets = bodies.filter(b => b.type === 'planet'), added = bodies.filter(b => b.addedAt !== undefined);
  const chaos = estimateChaos(), E = totalEnergy(), drift = stats.e0 ? (E - stats.e0)/Math.abs(stats.e0)*100 : 0;
  const gone = bodies.filter(escaping), ssPairs = Object.values(stats.pairs).filter(p => p.ss);
  const closest = ssPairs.reduce((m, p) => p.min < m.min ? p : m, { min:Infinity }), enc = ssPairs.reduce((n, p) => n + p.n, 0);
  const chaosTxt = !chaos ? 'could not be estimated' : chaos.lambda > .02
    ? `**chaotic**: nearby trajectories diverge exponentially (Lyapunov exponent λ ≈ ${f(chaos.lambda, 3)} per time unit, e-folding time ≈ ${f(1/chaos.lambda, 1)}). A measurement error of 1e-7 grows to order 1 in about ${f(chaos.horizon, 0)} time units`
    : `**regular or only weakly chaotic** (λ ≈ ${f(chaos.lambda, 3)}): errors grow slowly, so the orbits are predictable over the window tested`;
  const L = ['# Three-Body Simulation Report',
    `*Generated ${new Date().toLocaleString()} · simulated time t = ${f(t)} · ${stats.steps} integration steps · G = ${G}, ε = ${soft}, dt = ${dt}*`, '',
    '## 1. Summary', '',
    `- **Composition:** ${stars.length} star(s), ${planets.length} planet(s), ${bodies.filter(b => b.type === 'moon').length} moon(s), ${bodies.filter(b => b.type === 'other').length} other body(ies).`,
    `- **Dynamics:** the system is ${chaosTxt}.`,
    `- **Star encounters:** ${enc} close star-star encounter(s); closest approach ${closest.min < Infinity ? f(closest.min) + ' between ' + closest.a + ' and ' + closest.b + ' (t = ' + f(closest.tmin) + ')' : 'n/a'}.`,
    `- **Escapes:** ${gone.length ? gone.map(b => b.name).join(', ') + ' ' + (gone.length > 1 ? 'are' : 'is') + ' escaping the system' : 'no body has escaped yet'}.`,
    ...planets.map(p => { const e = classifyEnvironment(p); return `- **${p.name}:** ${e.climateLabel} climate, ${e.era}, water ${e.water.toLowerCase()}, life ${e.life.split(' ')[0].toLowerCase()}.`; }),
    `- **Your changes:** ${stats.events.length} body addition/removal event(s) and ${stats.edits} manual edit(s).`, '',
    '## 2. What is happening', '', '### Bodies right now', '',
    '| Body | Type | Mass | Position | Speed | Pulled most by | Status |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...bodies.map(b => { const pb = pullBreakdown(b)[0]; return `| ${b.name} | ${b.type} | ${b.mass} | (${f(b.x)}, ${f(b.y)}) | ${f(Math.hypot(b.vx, b.vy))} | ${pb ? pb.name + ' (' + f(pb.share, 0) + '%)' : 'n/a'} | ${escaping(b) ? 'escaping' : 'bound'} |`; }), '',
    '### The star system', '',
    `- Total energy is ${f(E, 3)} (${E < 0 ? 'negative: the system as a whole is gravitationally bound' : 'positive: at least one body has enough energy to leave for good'}).`,
    `- Energy change since the system was last modified: ${f(drift, 2)}% ${Math.abs(drift) < 1 ? '(the integrator is conserving energy well)' : '(large: close encounters with a fixed time step lose accuracy, try a smaller dt)'}.`,
    `- ${enc} close encounter(s) between suns so far; each one reshuffles momentum between the stars.`, '',
    '## 3. Why it is happening', '',
    `- **The force law:** every body pulls on every other with a = G · m / (r² + ε²), summed over all bodies (G = ${G}, softening ε = ${soft} stops the force blowing up in near-collisions).`,
    '- **Why three suns are chaotic:** with two bodies the orbit is a fixed ellipse. With three comparable masses each sun is pulled by the other two, so the force on it constantly changes direction and size. Poincaré showed there is no general closed-form solution, and tiny differences in starting conditions grow exponentially.',
    `- **Predictability:** ${chaos ? (chaos.lambda > .02 ? `a 1e-7 nudge to one body was amplified about ${f(Math.exp(chaos.lambda*10), 1)}× every 10 time units in a shadow run, which is why long-term prediction is impossible here.` : 'a 1e-7 nudge stayed small in a shadow run.') : 'not enough data.'}`,
    `- **Slingshots:** ${closest.min < .6 ? `${closest.a} and ${closest.b} passed within ${f(closest.min)}. Close passes swap momentum (a gravity assist); this is the mechanism that throws one body out while the other two settle into a tighter pair.` : 'no very close star-star passes yet, so the stars are exchanging energy gently.'}`, '',
    '## 4. Planets', '', ...(planets.length ? planets.flatMap(planetSection) : ['No planet is present, so there is no climate to report. Add one with the Planet button.', ''])];
  L.push('## 5. Bodies you added and how they changed the system', '');
  if(!stats.events.length) L.push('You did not add or remove any bodies in this run, so the system is the default three suns and one planet.', '');
  else L.push('### Timeline of your changes', '', '| Time | Change |', '| --- | --- |', ...stats.events.map(e => `| t = ${f(e.t)} | ${e.msg} |`), '');
  added.forEach(b => {
    const s = stats.per[b.uid] || { share:0, target:'', vmax:0 }, pb = pullBreakdown(b)[0];
    L.push(`### ${b.name} (${b.type}), added at t = ${f(b.addedAt)}`, '',
      `- **Mass:** ${b.mass}. **Status now:** ${escaping(b) ? 'escaping the system' : 'still bound to the system'}. **Fastest speed seen:** ${f(s.vmax)}.`,
      `- **Pulled most by:** ${pb ? pb.name + ' (' + f(pb.share, 0) + '% of the pull)' : 'n/a'}.`,
      `- **Influence on others:** at its strongest it supplied ${f(s.share*100, 1)}% of the pull on ${s.target || 'n/a'}${s.share < .01 ? ', which is negligible: a body this light is a passenger, not a driver' : ''}.`);
    if(b.type === 'star'){
      const inv = Object.values(stats.pairs).filter(p => p.a === b.name || p.b === b.name), cl = inv.reduce((m, p) => p.min < m.min ? p : m, { min:Infinity });
      L.push(`- **As a new sun:** it took part in ${inv.reduce((a, p) => a + p.n, 0)} close encounter(s); closest approach ${cl.min < Infinity ? f(cl.min) + ' (to ' + (cl.a === b.name ? cl.b : cl.a) + ')' : 'n/a'}. A fourth heavy body adds another strong pull, which raises both the chaos and the risk of ejections.`);
    }
    if(b.type === 'moon'){
      const par = planets.reduce((m, p) => Math.hypot(p.x-b.x, p.y-b.y) < m.d ? { p, d:Math.hypot(p.x-b.x, p.y-b.y) } : m, { p:null, d:Infinity });
      if(par.p){
        const a = classifyEnvironment(par.p).nd || 1, Ms = stars.reduce((x, o) => x + o.mass, 0) || 1, hill = a*Math.cbrt(par.p.mass/(3*Ms));
        const bound = .5*((b.vx-par.p.vx)**2 + (b.vy-par.p.vy)**2) - G*par.p.mass/par.d < 0;
        L.push(`- **Parent planet:** ${par.p.name}, separation ${f(par.d, 3)}. The Hill radius (where the planet's gravity beats the suns') is only about ${f(hill, 3)}. The moon is ${bound ? 'currently bound to' : 'not bound to'} the planet.`,
          `- **Verdict:** ${par.d > hill ? 'the moon sits outside the Hill radius, so the suns pull it away from the planet: it will not remain a moon.' : 'inside the Hill radius the moon can stay bound for a while, but every close pass of a sun will disturb it.'}`);
      }
    }
    L.push('');
  });
  if(stats.snap){
    const cf = counterfactual();
    L.push('### Effect on the original system', '');
    if(cf){
      const mx = Math.max(...cf.map(c => c.dev));
      L.push('Where the original bodies are now, compared with where they would be had nothing been added (same physics, same time span):', '', '| Body | Displacement from the no-additions timeline |', '| --- | --- |', ...cf.map(c => `| ${c.name} | ${f(c.dev)} |`), '',
        mx > .5 ? '- **Verdict:** the additions substantially changed the original trajectories. Chaos amplifies even a small extra pull.' : '- **Verdict:** the additions have so far barely changed the original trajectories.', '');
    } else L.push('The no-additions comparison is unavailable because bodies were removed or values were edited after the first addition.', '');
  }
  L.push('## 6. Method and limits', '',
    '- 2D Newtonian gravity, RK4 integration, softened point masses. Climate labels come from a toy model: insolation I = Σ mⱼ/dⱼ² is bucketed into Frozen, Temperate, Scorching and Boiling, and era comes from how much I varies over the recent past.',
    '- The chaos estimate is a shadow-run measurement over about 18 time units, not a rigorous Lyapunov calculation. Planets and moons are treated as point masses with no tides or rotation.',
    '- Real multi-star systems often have smaller, lighter planet-forming disks than single stars (Offner et al. 2022), which would make water and atmosphere even scarcer than this model suggests.');
  return L.join('\n');
}

export function mdToHtml(md){
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\*(?!\s)([^*]+)\*/g, '<i>$1</i>');
  let out = '', list = false, tbl = null;
  const close = () => { if(list){ out += '</ul>'; list = false; } if(tbl){ out += tbl + '</tbody></table>'; tbl = null; } };
  md.split('\n').forEach(l => {
    if(l[0] === '|'){
      if(/^[|\s:-]+$/.test(l)) return;
      const c = l.replace(/^\||\|$/g, '').split('|').map(x => inl(x.trim()));
      tbl = tbl === null ? '<div class="tw"><table><thead><tr>' + c.map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' : tbl + '<tr>' + c.map(x => '<td>' + x + '</td>').join('') + '</tr>';
      return;
    }
    let m;
    if((m = l.match(/^(#{1,3}) (.*)/))){ close(); out += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; }
    else if(l.startsWith('- ')){ if(tbl){ out += tbl + '</tbody></table></div>'; tbl = null; } if(!list){ out += '<ul>'; list = true; } out += '<li>' + inl(l.slice(2)) + '</li>'; }
    else if(!l.trim()){ if(tbl){ out += tbl + '</tbody></table></div>'; tbl = null; } close(); }
    else { close(); out += '<p>' + inl(l) + '</p>'; }
  });
  if(tbl) out += tbl + '</tbody></table></div>';
  return out.replace(/<\/tbody><\/table><\/tbody><\/table>/g, '</tbody></table>') + (list ? '</ul>' : '');
}

function showReport(){
  lastMD = buildReportMD();
  document.getElementById('reportBody').innerHTML = mdToHtml(lastMD);
  const sec = document.getElementById('report'); sec.hidden = false;
  if(sec.scrollIntoView) sec.scrollIntoView({ behavior:'smooth', block:'start' });
}
function downloadMD(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lastMD], { type:'text/markdown' }));
  a.download = 'three-body-report-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.md';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}




export const OBSERVE_MS = 30000;
export type SimulationControls = { G:number; soft:number; dt:number };
export type SimBody = any;
export type ViewState = { vel:boolean; grav:boolean; trails:boolean; labels:boolean };
export type Environment = any;

export function initSimulationState(next: SimulationControls = {G:1, soft:0.05, dt:0.003}) {
  controls = {...next};
  resetState();
  running = true;
}

export function setControls(next: Partial<SimulationControls>) { controls = {...controls, ...next}; }
export function getControls() { return {...controls}; }
export function getBodies(): SimBody[] { return bodies || []; }
export function getTime() { return t || 0; }
export function getRunning() { return running; }
export function setRunning(v:boolean) { running = v; }
export function getView(): ViewState { return {...view}; }
export function setView(next: Partial<ViewState>) { Object.assign(view, next); }
export function setTheme(light:boolean) { lightTheme = light; }
export function resetSimulation() { resetState(); running = true; }
export function stepSimulation() { step(); }
export function advanceSimulation(count:number) { for(let i=0;i<count;i++) step(); }
export function addStarBody() { const a=Math.random()*6.28; addBody({name:'New Star',mass:0.5,x:1.6*Math.cos(a),y:1.6*Math.sin(a),vx:-Math.sin(a)*.45,vy:Math.cos(a)*.45,type:'star',color:warmColor()}); }
export function addPlanetBody() { addPlanet(); }
export function addMoonBody() { addMoon(); }
export function addOtherBody() { addBody({}); }
export function removeBodyAt(i:number) { removeBody(i); }
export function editBody(i:number, key:string, value:number) { if(!isNaN(value) && bodies[i]) { bodies[i][key]=value; trails[i]=[]; noteEdit(); } }
export function getEnvironmentForBody(body:any) { return classifyEnvironment(body); }
export function getEnvironments(): Record<string, Environment> { const out:any={}; (bodies||[]).forEach((b:any)=>{if(b.type==='planet') out[b.uid]=classifyEnvironment(b);}); return out; }
export function getReportReady() { return Date.now()-lastChangeAt >= OBSERVE_MS; }
export function getReportRemainingMs() { return Math.max(0, OBSERVE_MS-(Date.now()-lastChangeAt)); }
export function buildCurrentReport() { lastMD = buildReportMD(); return lastMD; }
export function getLastReport() { return lastMD; }
export function downloadCurrentReport() {
  const md = lastMD || buildReportMD();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], {type:'text/markdown'}));
  a.download = 'three-body-report-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.md';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
export function mountCanvas(canvas: HTMLCanvasElement) {
  cv = canvas; ctx = canvas.getContext('2d'); if(!ctx) throw new Error('2D canvas context unavailable'); resize();
  return () => { cv = undefined; ctx = undefined; };
}
export function resizeCanvas() { resize(); }
export function renderFrame(tm:number) { if(ctx) draw(tm); }
export function observeAndStep(speed:number) { if(running) advanceSimulation(speed); }
export function getStatsSnapshot() { return {time:t||0, bodies:(bodies||[]).map((b:any)=>({...b})), env:getEnvironments(), reportReady:getReportReady(), reportRemainingMs:getReportRemainingMs()}; }
