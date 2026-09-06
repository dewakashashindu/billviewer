// ============================================================
// LOCATION: components/MicroChefLoader.tsx
// ALUTH FILE — mekamama create karanna
//
// MicroEChef brand loader — 6-ring pulse animation (pure SVG+CSS,
// dependencies naha). Bill viewer loading screen ekata use wenawa.
// UI strings ENGLISH witharai.
// ============================================================
const MCF_CSS = `
  .mcf-pl circle {
    transform-box: fill-box;
    transform-origin: 50% 50%;
  }
  .mcf__ring1 { animation: mcf-ring1_ 4s 0s ease-in-out infinite; }
  .mcf__ring2 { animation: mcf-ring2_ 4s 0.04s ease-in-out infinite; }
  .mcf__ring3 { animation: mcf-ring3_ 4s 0.08s ease-in-out infinite; }
  .mcf__ring4 { animation: mcf-ring4_ 4s 0.12s ease-in-out infinite; }
  .mcf__ring5 { animation: mcf-ring5_ 4s 0.16s ease-in-out infinite; }
  .mcf__ring6 { animation: mcf-ring6_ 4s 0.2s ease-in-out infinite; }

  @keyframes mcf-ring1_ {
    from { stroke-dashoffset: -376.237129776; transform: rotate(-0.25turn); animation-timing-function: ease-in; }
    23% { stroke-dashoffset: -94.247778; transform: rotate(1turn); animation-timing-function: ease-out; }
    46%, 50% { stroke-dashoffset: -376.237129776; transform: rotate(2.25turn); animation-timing-function: ease-in; }
    73% { stroke-dashoffset: -94.247778; transform: rotate(3.5turn); animation-timing-function: ease-out; }
    96%, to { stroke-dashoffset: -376.237129776; transform: rotate(4.75turn); }
  }
  @keyframes mcf-ring2_ {
    from { stroke-dashoffset: -329.207488554; transform: rotate(-0.25turn); animation-timing-function: ease-in; }
    23% { stroke-dashoffset: -82.46680575; transform: rotate(1turn); animation-timing-function: ease-out; }
    46%, 50% { stroke-dashoffset: -329.207488554; transform: rotate(2.25turn); animation-timing-function: ease-in; }
    73% { stroke-dashoffset: -82.46680575; transform: rotate(3.5turn); animation-timing-function: ease-out; }
    96%, to { stroke-dashoffset: -329.207488554; transform: rotate(4.75turn); }
  }
  @keyframes mcf-ring3_ {
    from { stroke-dashoffset: -288.4484661616; transform: rotate(-0.25turn); animation-timing-function: ease-in; }
    23% { stroke-dashoffset: -72.2566298; transform: rotate(1turn); animation-timing-function: ease-out; }
    46%, 50% { stroke-dashoffset: -288.4484661616; transform: rotate(2.25turn); animation-timing-function: ease-in; }
    73% { stroke-dashoffset: -72.2566298; transform: rotate(3.5turn); animation-timing-function: ease-out; }
    96%, to { stroke-dashoffset: -288.4484661616; transform: rotate(4.75turn); }
  }
  @keyframes mcf-ring4_ {
    from { stroke-dashoffset: -253.9600625988; transform: rotate(-0.25turn); animation-timing-function: ease-in; }
    23% { stroke-dashoffset: -63.61725015; transform: rotate(1turn); animation-timing-function: ease-out; }
    46%, 50% { stroke-dashoffset: -253.9600625988; transform: rotate(2.25turn); animation-timing-function: ease-in; }
    73% { stroke-dashoffset: -63.61725015; transform: rotate(3.5turn); animation-timing-function: ease-out; }
    96%, to { stroke-dashoffset: -253.9600625988; transform: rotate(4.75turn); }
  }
  @keyframes mcf-ring5_ {
    from { stroke-dashoffset: -225.7422778656; transform: rotate(-0.25turn); animation-timing-function: ease-in; }
    23% { stroke-dashoffset: -56.5486668; transform: rotate(1turn); animation-timing-function: ease-out; }
    46%, 50% { stroke-dashoffset: -225.7422778656; transform: rotate(2.25turn); animation-timing-function: ease-in; }
    73% { stroke-dashoffset: -56.5486668; transform: rotate(3.5turn); animation-timing-function: ease-out; }
    96%, to { stroke-dashoffset: -225.7422778656; transform: rotate(4.75turn); }
  }
  @keyframes mcf-ring6_ {
    from { stroke-dashoffset: -203.795111962; transform: rotate(-0.25turn); animation-timing-function: ease-in; }
    23% { stroke-dashoffset: -51.05087975; transform: rotate(1turn); animation-timing-function: ease-out; }
    46%, 50% { stroke-dashoffset: -203.795111962; transform: rotate(2.25turn); animation-timing-function: ease-in; }
    73% { stroke-dashoffset: -51.05087975; transform: rotate(3.5turn); animation-timing-function: ease-out; }
    96%, to { stroke-dashoffset: -203.795111962; transform: rotate(4.75turn); }
  }
`;

export default function MicroChefLoader({ size = 118 }: { size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <style>{MCF_CSS}</style>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 128 128"
        height={size}
        width={size}
        className="mcf-pl"
        role="img"
        aria-label="MicroEChef loading animation"
      >
        <circle
          className="mcf__ring1"
          cx="64"
          cy="64"
          r="60"
          fill="none"
          stroke="hsl(3,90%,55%)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="377 377"
          strokeDashoffset="-376.4"
          transform="rotate(-90,64,64)"
        />
        <circle
          className="mcf__ring2"
          cx="64"
          cy="64"
          r="52.5"
          fill="none"
          stroke="hsl(13,90%,55%)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="329.9 329.9"
          strokeDashoffset="-329.3"
          transform="rotate(-90,64,64)"
        />
        <circle
          className="mcf__ring3"
          cx="64"
          cy="64"
          r="46"
          fill="none"
          stroke="hsl(23,90%,55%)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="289 289"
          strokeDashoffset="-288.6"
          transform="rotate(-90,64,64)"
        />
        <circle
          className="mcf__ring4"
          cx="64"
          cy="64"
          r="40.5"
          fill="none"
          stroke="hsl(33,90%,55%)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="254.5 254.5"
          strokeDashoffset="-254"
          transform="rotate(-90,64,64)"
        />
        <circle
          className="mcf__ring5"
          cx="64"
          cy="64"
          r="36"
          fill="none"
          stroke="hsl(43,90%,55%)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="226.2 226.2"
          strokeDashoffset="-225.8"
          transform="rotate(-90,64,64)"
        />
        <circle
          className="mcf__ring6"
          cx="64"
          cy="64"
          r="32.5"
          fill="none"
          stroke="hsl(53,90%,55%)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="204.2 204.2"
          strokeDashoffset="-203.9"
          transform="rotate(-90,64,64)"
        />
      </svg>

      {/* Brand text — logo colors (Micro = orange, EChef = blue) */}
      <p
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: 0.6,
          lineHeight: 1,
        }}
      >
        <span style={{ color: "#ea580c" }}>Micro</span>
        <span style={{ color: "#1d4ed8" }}>EChef</span>
      </p>
    </div>
  );
}
