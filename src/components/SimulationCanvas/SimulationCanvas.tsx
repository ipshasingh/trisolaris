import { useEffect, useRef } from 'react';
import { advanceSimulation, getRunning, mountCanvas, renderFrame, resizeCanvas } from '../../simulation';

interface Props { speed:number; paused:boolean; onFrame:()=>void }
export function SimulationCanvas({speed,paused,onFrame}:Props){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(!ref.current) return;
    const cleanup=mountCanvas(ref.current);
    const onResize=()=>resizeCanvas();
    window.addEventListener('resize',onResize);
    let raf=0;
    const loop=(tm:number)=>{
      if(!paused && getRunning()) advanceSimulation(speed);
      renderFrame(tm);
      onFrame();
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',onResize);cleanup();};
  },[speed,paused,onFrame]);
  return <canvas id="cv" ref={ref}/>;
}
