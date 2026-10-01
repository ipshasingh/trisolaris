interface HeaderProps { light:boolean; onTheme:()=>void }
export function Header({light,onTheme}:HeaderProps){
  return <>
    <div className="brand"><h1>Three-Body Simulator</h1><p>Newtonian gravity, live. Add a star, planet or moon and watch the chaos respond.</p></div>
    <button className="theme-toggle" title="Toggle light/dark" onClick={onTheme}>{light ? '☀️' : '🌙'}</button>
  </>;
}
