import type { CSSProperties } from 'react';

/** Visual placeholder for content that is genuinely being fetched. */
export default function SkeletonLoader({label='Loading data…',rows=4,compact=false}:{label?:string;rows?:number;compact?:boolean}) {
 const count=Math.max(1,Math.min(8,rows));
 const wrap:CSSProperties={padding:compact?'10px':'18px 24px',width:'100%',boxSizing:'border-box'};
 return <div style={wrap} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
  <style>{`.skel-list{display:grid;gap:9px}.skel-row{display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border:1px solid #eee3d7;border-radius:9px}.skel-shape{background:linear-gradient(100deg,#eee7df 20%,#f9f5f0 45%,#eee7df 70%);background-size:220% 100%;animation:skeleton-wave 1.5s ease-in-out infinite;border-radius:4px}.skel-icon{width:40px;height:38px;flex:none}.skel-lines{flex:1;min-width:0;display:grid;gap:6px}.skel-line{height:7px;width:85%}.skel-line.second{width:64%}.skel-line.third{width:43%}@keyframes skeleton-wave{to{background-position:-220% 0}}@media(prefers-reduced-motion:reduce){.skel-shape{animation:none}}`}</style>
  <span style={{display:'block',fontSize:12,color:'#765e4d',marginBottom:10}}>{label}</span><div className="skel-list" aria-hidden="true">{Array.from({length:count},(_,i)=><div className="skel-row" key={i}><div className="skel-shape skel-icon"/><div className="skel-lines"><div className="skel-shape skel-line"/><div className="skel-shape skel-line second"/><div className="skel-shape skel-line third"/></div></div>)}</div>
 </div>;
}
