import { useEffect, useState } from 'react';
import { buildCurrentReport, downloadCurrentReport, mdToHtml } from '../../simulation';
export function Report({open,onClose}:{open:boolean;onClose?:()=>void}){
 const [html,setHtml]=useState('');
 useEffect(()=>{if(open){const md=buildCurrentReport();setHtml(mdToHtml(md));setTimeout(()=>document.getElementById('report')?.scrollIntoView({behavior:'smooth',block:'start'}),0);}},[open]);
 return <section id="report" hidden={!open}><div className="report-head"><h2>Simulation report</h2><div style={{display:'flex',gap:'.5rem'}}><button className="primary" onClick={downloadCurrentReport}>⬇ Download .md</button>{onClose&&<button onClick={onClose}>Close</button>}</div></div><div id="reportBody" dangerouslySetInnerHTML={{__html:html}}/></section>;
}
