import { useCallback, useState } from 'react';
import './styles.css';
import { AddDock } from './components/Header/AddDock';
import { Header } from './components/Header/Header';
import { SimulationCanvas } from './components/SimulationCanvas/SimulationCanvas';
import { EnvironmentPanel } from './components/EnvironmentPanel/EnvironmentPanel';
import { PhysicsPanel } from './components/PhysicsPanel/PhysicsPanel';
import { SimulationControls } from './components/SimulationControls/SimulationControls';
import { Report } from './components/Report/Report';
import {
  addMoonBody, addOtherBody, addPlanetBody, addStarBody, editBody, getStatsSnapshot,
  getView, initSimulationState, removeBodyAt, resetSimulation, setControls, setRunning,
  setTheme, setView, stepSimulation, getRunning, buildCurrentReport
} from './simulation';
import { useEffect, useRef } from 'react';

export default function App(){
  const initialized=useRef(false);
  if(!initialized.current){ initSimulationState(); initialized.current=true; }
  const [light,setLight]=useState(false);
  const [running,setRunningState]=useState(true);
  const [speed,setSpeed]=useState(4);
  const [labels,setLabels]=useState(true);
  const [controls,setControlsState]=useState({G:1,soft:.05,dt:.003});
  const [view,setViewState]=useState(getView());
  const [snapshot,setSnapshot]=useState(getStatsSnapshot());
  const [reportOpen,setReportOpen]=useState(false);

  const refresh=useCallback(()=>setSnapshot(getStatsSnapshot()),[]);
  useEffect(()=>{ const id=setInterval(refresh,120); return ()=>clearInterval(id); },[refresh]);
  const toggle=()=>{const next=!running;setRunning(next);setRunningState(next);};
  const reset=()=>{resetSimulation();setRunningState(true);setReportOpen(false);refresh();};
  const changeControl=(k:string,v:number)=>{if(Number.isFinite(v)){setControls({[k]:v});setControlsState(c=>({...c,[k]:v}));}};
  const changeView=(k:string,v:boolean)=>{setView({[k]:v});setViewState(x=>({...x,[k]:v}));};
  const toggleLabels=()=>{const next=!labels;setLabels(next);setView({labels:next});setViewState(x=>({...x,labels:next}));};
  const add=(fn:()=>void)=>{fn();refresh();};
  const report=()=>{buildCurrentReport();setReportOpen(true);};

  return <>
    <div id="stage">
      <SimulationCanvas speed={speed} paused={!running} onFrame={refresh}/>
      <Header light={light} onTheme={()=>{const next=!light;setLight(next);setTheme(next);document.documentElement.dataset.theme=next?'light':'dark';}}/>
      <AddDock onStar={()=>add(addStarBody)} onPlanet={()=>add(addPlanetBody)} onMoon={()=>add(addMoonBody)} onBody={()=>add(addOtherBody)}/>
      <EnvironmentPanel bodies={snapshot.bodies} env={snapshot.env}/>
      <PhysicsPanel controls={controls} onControlsChange={changeControl} view={view} onViewChange={changeView} bodies={snapshot.bodies} onEdit={(i:string,k:string,v:number)=>{editBody(+i,k,v);refresh();}} onRemove={(i:number)=>{removeBodyAt(i);refresh();}}/>
      <SimulationControls running={running} speed={speed} time={snapshot.time} count={snapshot.bodies.length} labels={labels} onToggle={toggle} onStep={()=>{stepSimulation();refresh();}} onReset={reset} onLabels={toggleLabels} onSpeed={setSpeed} onReport={report} reportReady={snapshot.reportReady} remaining={snapshot.reportRemainingMs}/>
    </div>
    <Report open={reportOpen}/>
  </>;
}
