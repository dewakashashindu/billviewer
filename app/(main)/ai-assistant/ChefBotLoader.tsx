export default function ChefBotLoader() { return (
<div className="chefbot-loader" role="status" aria-live="polite" aria-label="EChef is preparing your answer">
  <svg className="cb-bot" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M27 38q-9-2-7-11 2-8 10-7 3-10 17-8 14-2 17 8 9-1 10 7 2 9-7 11z" fill="#fff6ea"/>
    <rect x="28" y="34" width="44" height="6" rx="3" fill="#f1dcc3"/>
    <rect x="24" y="38" width="52" height="34" rx="16" fill="#2a1d15" stroke="#ffb45a" strokeOpacity=".7" strokeWidth="1.5"/>
    <rect x="30" y="44" width="40" height="22" rx="10" fill="#0b0705"/>
    <g className="cb-eyes"><ellipse className="cb-eye" cx="42" cy="54" rx="4" ry="5" fill="#ffb45a"/><ellipse className="cb-eye" cx="58" cy="54" rx="4" ry="5" fill="#ffb45a"/></g>
    <path d="M45 61q5 3 10 0" stroke="#ffb45a" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    <rect x="19" y="50" width="5" height="12" rx="2.5" fill="#ffb45a"/><rect x="76" y="50" width="5" height="12" rx="2.5" fill="#ffb45a"/>
    <rect x="30" y="74" width="40" height="22" rx="11" fill="#2a1d15" stroke="#ffb45a" strokeOpacity=".5"/>
    <circle className="cb-core" cx="50" cy="85" r="5" fill="#ffd9a0"/>
    <g className="cb-arm"><path d="M70 80q10 0 14-10" stroke="#4a3528" strokeWidth="5" strokeLinecap="round" fill="none"/><circle cx="85" cy="68" r="4.5" fill="#ffb45a"/></g>
  </svg>
  <svg className="cb-build" viewBox="0 0 96 70" aria-hidden="true">
    <line x1="2" y1="64" x2="94" y2="64" stroke="#ffb45a" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round"/>
    <g>
      <rect className="cb-bar" x="8" y="34" width="14" height="30" rx="3" fill="#e07a3a"/>
      <rect className="cb-bar" x="28" y="18" width="14" height="46" rx="3" fill="#ffb45a"/>
      <rect className="cb-bar" x="48" y="28" width="14" height="36" rx="3" fill="#e07a3a"/>
      <rect className="cb-bar" x="68" y="8" width="14" height="56" rx="3" fill="#ffd9a0"/>
    </g>
    <circle className="cb-spark" cx="6" cy="62" r="2.5" fill="#fff6ea"/>
  </svg>
  <div className="cb-text">
    <div className="cb-status">
      <span>Reading your question…</span>
      <span>Checking the numbers…</span>
      <span>Building your answer…</span>
    </div>
    <div className="cb-dots"><i></i><i></i><i></i></div>
    <div className="cb-track"><b></b></div>
  </div>
</div>
); }
