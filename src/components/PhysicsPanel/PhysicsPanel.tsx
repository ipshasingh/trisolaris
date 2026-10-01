import { useState } from 'react';
import { BodyControls } from '../BodyControls/BodyControls';
export function PhysicsPanel({controls,onControlsChange,view,onViewChange,bodies,onEdit,onRemove}:{controls:any;onControlsChange:(k:string,v:number)=>void;view:any;onViewChange:(k:string,v:boolean)=>void;bodies:any[];onEdit:any;onRemove:any}){
 const [collapsed,setCollapsed]=useState(false);
 return <aside className={`float right${collapsed?' collapsed':''}`}><div className="fhead" onClick={()=>setCollapsed(v=>!v)}><span>Physics &amp; bodies</span><em>▾</em></div><div className="fbody"><div className="formula mono">aᵢ = G · Σⱼ mⱼ (rⱼ − rᵢ) / (|rⱼ − rᵢ|² + ε²)<sup>3/2</sup></div><div className="const-row">
 {([['G','G',.1],['ε softening','soft',.01],['dt','dt',.001]] as const).map(([label,k,step])=><label key={k}>{label}<input type="number" step={step} value={controls[k]} onChange={e=>onControlsChange(k,parseFloat(e.target.value))}/></label>)}
 </div><div className="views">
 {[['vel','Velocity','#6ee7a0'],['grav','Gravity','#ff9646'],['trails','Trails','#9aa0ff']].map(([k,label,color])=><label key={k}><input type="checkbox" checked={view[k]} onChange={e=>onViewChange(k,e.target.checked)}/><span className="key" style={{background:color}}></span>{label}</label>)}
 </div><p className="note">Green arrow = velocity. Orange arrow = net gravitational pull. Dashed ties = pairwise gravity (thicker = stronger). Thicker trails = faster motion. Edit any number below — the simulation reacts instantly.</p><BodyControls bodies={bodies} onEdit={onEdit} onRemove={onRemove}/></div></aside>;
}
