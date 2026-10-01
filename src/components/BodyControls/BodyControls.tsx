export function BodyControls({bodies,onEdit,onRemove}:{bodies:any[];onEdit:(i:number,k:string,v:number)=>void;onRemove:(i:number)=>void}){
 return <div id="bodyEditors">{bodies.map((b,i)=><div className="body-block" key={b.uid}><div className="body-title"><span className="dot" style={{background:b.color}}></span>{b.name}<span className="mono" style={{color:'var(--muted)',fontSize:'.7rem'}}>({b.type})</span>{b.addedAt!==undefined&&<button onClick={()=>onRemove(i)} style={{marginLeft:'auto',background:'none',border:'1px solid var(--border)',borderRadius:4,padding:'.1rem .5rem',fontSize:'.75rem',cursor:'pointer',color:'var(--muted)'}}>✕</button>}</div><div className="field-grid">
 {(['mass','x','y','vx','vy'] as const).map(k=><label key={k}>{k}<input type="number" step={k==='x'||k==='y'?'0.1':'0.01'} value={b[k]} onChange={e=>onEdit(i,k,parseFloat(e.target.value))}/></label>)}
 </div></div>)}</div>;
}
