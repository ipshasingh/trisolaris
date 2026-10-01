import type { CSSProperties } from 'react';
import { useState } from 'react';
function Stage({kind,icon,color,anim,value}:{kind:string;icon:string;color:string;anim:string;value:string}){
  return <div className="env-item"><div className="icon-stage" style={{'--glow':color} as CSSProperties}><span className={anim}>{icon}</span></div><span className="env-label">{kind}<b>{value}</b></span></div>;
}
function envIcons(e:any){
 const none=e.climateLabel==='–';
 return {
  climate:[none?'❔':e.climateLabel==='Frozen'?'❄️':e.climateLabel==='Temperate'?'🌡️':e.climateLabel==='Scorching'?'🔥':'☄️',none?'':e.climateLabel==='Frozen'?'anim-shimmer':e.climateLabel==='Boiling'?'anim-fade':'anim-breathe'],
  water:[none?'❔':e.water==='Ice'?'🧊':e.water==='Liquid'?'💧':e.water.startsWith('Vapor')?'💨':'🫙',none?'':e.water==='Liquid'?'anim-float':e.water==='Ice'?'anim-shimmer':e.water.startsWith('Vapor')?'anim-drift':'anim-fade'],
  atmo:[none?'❔':e.atmo==='Stable'?'🌫️':e.atmo==='Frozen solid'?'🧊':'💨',none?'':e.atmo==='Stable'?'anim-breathe':e.atmo==='Frozen solid'?'anim-shimmer':'anim-drift'],
  life:[none?'❔':e.life.startsWith('Flourishing')?'🌱':e.life.startsWith('Dormant')?'💧':'☠️',none?'':e.life.startsWith('Flourishing')?'anim-grow':e.life.startsWith('Dormant')?'anim-breathe':'anim-fade']
 };
}
export function EnvironmentPanel({bodies,env}:{bodies:any[];env:Record<string,any>}){
 const [collapsed,setCollapsed]=useState(false);
 const planets=bodies.filter(b=>b.type==='planet');
 return <aside className={`float left${collapsed?' collapsed':''}`}><div className="fhead" onClick={()=>setCollapsed(v=>!v)}><span>Planet status</span><em>▾</em></div><div className="fbody"><div id="envCards">
 {planets.length===0?<p className="note">No planet in the system yet — click "+ Planet" to add one.</p>:planets.map(b=>{const e=env[b.uid]||{};const i=envIcons(e);return <div className="env-card" key={b.uid}>
  <div className="env-card-title"><span className="dot" style={{background:b.color}}></span>{b.name}</div>
  <div className="env-visual">
   <Stage kind="Climate" icon={i.climate[0]} color={e.climateColor||'#5ec98f'} anim={i.climate[1]} value={e.climateLabel||'–'}/><Stage kind="Water" icon={i.water[0]} color={e.climateColor||'#5ec98f'} anim={i.water[1]} value={e.water||'–'}/><Stage kind="Atmosphere" icon={i.atmo[0]} color={e.climateColor||'#5ec98f'} anim={i.atmo[1]} value={e.atmo||'–'}/><Stage kind="Life" icon={i.life[0]} color={e.climateColor||'#5ec98f'} anim={i.life[1]} value={(e.life||'–').replace(/[🌱💧⚠️]/g,'').trim()}/>
  </div>
  <div className="stat-row" style={{marginBottom:'.3rem'}}><span>I=<b className="mono">{typeof e.inso==='number'?e.inso.toFixed(2):'–'}</b></span><span>Era: <b className="mono">{e.era||'–'}</b></span><span>g=<b className="mono">{typeof e.grav==='number'?e.grav.toFixed(2):'–'}</b></span></div>
  <div className="stat-row"><span>Nearest sun: <b className="mono">{e.nearest||'–'}{e.nd!==undefined?` (${e.nd.toFixed(2)})`:''}</b></span></div>
 </div>})}
 </div><p className="note">Each planet's climate is computed from its own light history: I = Σ mⱼ/dⱼ². Wild swings mean a <b>Chaotic Era</b>; a narrow band means a <b>Stable Era</b>. Real multi-star systems have smaller planet-forming disks and rarely keep stable circumbinary ones (Offner et al. 2022).</p></div></aside>;
}
