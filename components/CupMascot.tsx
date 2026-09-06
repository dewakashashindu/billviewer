"use client";

// ============================================================
// LOCATION: components/CupMascot.tsx
// ALUTH FILE — mekamama create karanna
//
// Animated coffee-cup mascot ("Moody Foodies" style — original
// artwork by Jonas Mosesson, codepen port by Noel Delgado).
// Reimplemented dependency-free: shapes are faithful ports,
// animation = single requestAnimationFrame loop (no GSAP /
// MorphSVG premium plugins).
//   • cup rock + face wobble + blinking + mouth open/close
//   • floating cup-top with sloshing coffee surface
//   • vapor waves (per-point oscillation) + falling sweat drops
//   • ground shadow pulse
// Use: no-bill / error state of the bill viewer.
// ============================================================
import { useEffect, useRef } from "react";

const RING = "#F7F7E7";
const CREAM = "#EAE6D8";
const SHADE = "#D6D6BE";
const INK = "#4A4342";
const GROUND = "#C6C39A";
const FOOT = "#272D21";
const DROP_BLUE = "#8FCFFE";

export default function CupMascot({ width = 340 }: { width?: number }) {
  const cupRef = useRef<SVGGElement>(null);
  const topRef = useRef<SVGGElement>(null);
  const coffeeRef = useRef<SVGPathElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const eyesOpenRef = useRef<SVGGElement>(null);
  const eyesClosedRef = useRef<SVGGElement>(null);
  const mouthARef = useRef<SVGPathElement>(null);
  const mouthBRef = useRef<SVGGElement>(null);
  const vaporRef = useRef<SVGGElement>(null);
  const wave0 = useRef<SVGPolylineElement>(null);
  const wave1 = useRef<SVGPolylineElement>(null);
  const wave2 = useRef<SVGPolylineElement>(null);
  const shadowRef = useRef<SVGPathElement>(null);
  const dropRefs = [
    useRef<SVGPathElement>(null),
    useRef<SVGPathElement>(null),
    useRef<SVGPathElement>(null),
    useRef<SVGPathElement>(null),
  ];

  useEffect(() => {
    let raf = 0;
    const waves = [wave0.current, wave1.current, wave2.current].filter(
      Boolean
    ) as SVGPolylineElement[];

    const tick = () => {
      const t = performance.now() / 1000;

      // ── cup rock (origin ~ feet) ──
      const rock = 2 * Math.sin(t * 2.2);
      if (cupRef.current)
        cupRef.current.setAttribute(
          "transform",
          `rotate(${rock.toFixed(2)} 387 346)`
        );

      // ── floating cup top + sloshing coffee ──
      if (topRef.current) {
        const tx = 317 + 3 * Math.sin(t * 2.2 + 0.9);
        const ty = 86 + 5 * Math.sin(t * 4.4 + 0.5);
        const tr = -10 + 9 * Math.sin(t * 2.2 + 1.1);
        topRef.current.setAttribute(
          "transform",
          `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${tr.toFixed(1)} 69 93)`
        );
      }
      if (coffeeRef.current)
        coffeeRef.current.setAttribute(
          "transform",
          `translate(10 ${(10 + 2.4 * Math.sin(t * 3.1)).toFixed(2)}) rotate(${(
            2.5 * Math.sin(t * 2.2 + 0.3)
          ).toFixed(2)} 68 98)`
        );

      // ── face wobble + blink + mouth ──
      if (faceRef.current) {
        const fx = 356 + 2 * Math.sin(t * 2.2 + 0.5);
        const fy = 262 + 3 * Math.sin(t * 4.4);
        const fr = -4 + 3 * Math.sin(t * 2.2 + 0.4);
        faceRef.current.setAttribute(
          "transform",
          `translate(${fx.toFixed(1)} ${fy.toFixed(1)}) rotate(${fr.toFixed(1)})`
        );
      }
      const blink = t % 2.8 > 2.55;
      if (eyesOpenRef.current)
        eyesOpenRef.current.setAttribute("opacity", blink ? "0" : "1");
      if (eyesClosedRef.current)
        eyesClosedRef.current.setAttribute("opacity", blink ? "1" : "0");
      const mouthOpen = t % 4 > 1.8 && t % 4 < 2.6;
      if (mouthARef.current)
        mouthARef.current.setAttribute("opacity", mouthOpen ? "0" : "1");
      if (mouthBRef.current)
        mouthBRef.current.setAttribute("opacity", mouthOpen ? "1" : "0");

      // ── vapor waves — per-point oscillation ──
      for (let w = 0; w < waves.length; w++) {
        const pts: string[] = [];
        for (let i = 0; i <= 8; i++) {
          const x = 2 * Math.sin(t * 4 + i * 0.85 + w * 1.3);
          pts.push(`${x.toFixed(2)},${i * 7}`);
        }
        waves[w].setAttribute("points", pts.join(" "));
      }
      if (vaporRef.current)
        vaporRef.current.setAttribute(
          "transform",
          `translate(365 ${(85 + 6 * Math.sin(t * 2.4 + 1)).toFixed(1)})`
        );

      // ── ground shadow pulse ──
      if (shadowRef.current) {
        const sx = 0.86 + 0.14 * Math.sin(t * 2.2 + 1.5);
        shadowRef.current.setAttribute(
          "transform",
          `translate(${(403.5 * (1 - sx)).toFixed(1)} 0) scale(${sx.toFixed(3)} 1)`
        );
      }

      // ── sweat drops (staggered falls) ──
      const dropBase = [
        [428, 258],
        [342, 239],
        [438, 230],
        [383, 219],
      ];
      dropRefs.forEach((ref, i) => {
        if (!ref.current) return;
        const p = ((t + i * 0.75) % 3) / 3; // 0..1
        const s = Math.sin(p * Math.PI); // grow then shrink
        const dy = 34 * p;
        ref.current.setAttribute(
          "transform",
          `translate(${dropBase[i][0]} ${(dropBase[i][1] + dy).toFixed(
            1
          )}) scale(${s.toFixed(3)})`
        );
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const waveEl = (ref: React.RefObject<SVGPolylineElement | null>, dx: number) => (
    <polyline
      ref={ref}
      stroke={SHADE}
      strokeWidth={6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform={`translate(${dx} 0)`}
      points="0,0"
    />
  );

  return (
    <svg
      width={width}
      viewBox="0 0 800 400"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Coffee cup loading animation"
      style={{ display: "block", maxWidth: "100%" }}
    >
      <defs>
        <clipPath id="mcm-cup-clip">
          <path d="M312,190 L446,164 C455.679978,208.942066 460.800657,255.464673 463,303 C470.179673,326.771115 327.481478,334.20088 327,305 C322.662603,253.027247 317.662603,214.693913 312,190 Z" />
        </clipPath>
        <clipPath id="mcm-top-clip">
          <path d="M7.02184767,92 L7,92 L7,0 L129,0 L129,92 L128.978152,92 C128.992687,92.1661301 129,92.332806 129,92.5 C129,102.717268 101.68937,111 68,111 C34.3106303,111 7,102.717268 7,92.5 C7,92.332806 7.00731313,92.1661301 7.02184767,92 Z" />
        </clipPath>
      </defs>

      {/* ── vapor ── */}
      <g ref={vaporRef} transform="translate(365 85)">
        {waveEl(wave0, 0)}
        {waveEl(wave1, 28)}
        {waveEl(wave2, 56)}
      </g>

      {/* ── ground shadow ── */}
      <path
        ref={shadowRef}
        d="M364,346 L443,346"
        stroke={GROUND}
        strokeLinecap="round"
        strokeWidth={8}
      />

      {/* ── feet ── */}
      <g fill="none" stroke={FOOT} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M388,346 L395,346 C392.196088,337.186786 390.95329,325.697713 396,314" />
        <path d="M388,346 L395,346 C392.196088,337.186786 390.95329,325.697713 396,314" transform="translate(20 0)" />
      </g>

      {/* ── rocking cup (handle + body + top + face) ── */}
      <g ref={cupRef}>
        {/* handle */}
        <path
          d="M456.068833,278.354024 L467.467696,278.354024 C486.549917,278.354024 487.600989,251.846024 467.467696,251.846024 L456.068833,251.846024 L456.068833,235.278523 L472.885983,235.278523 C506.866127,240.765221 503.336232,293.786731 472.885983,296.026024 L456.068833,296.026024 L456.068833,278.354024 Z"
          fill={SHADE}
        />
        {/* body + inner shade */}
        <path
          d="M312,190 L446,164 C455.679978,208.942066 460.800657,255.464673 463,303 C470.179673,326.771115 327.481478,334.20088 327,305 C322.662603,253.027247 317.662603,214.693913 312,190 Z"
          fill={CREAM}
        />
        <path
          d="M431,160 C443,210 444,275 447,326 L470,320 L455,157 L431,160 Z"
          fill={SHADE}
          clipPath="url(#mcm-cup-clip)"
        />

        {/* floating cup top + coffee */}
        <g ref={topRef}>
          <path
            d="M69,118 C30.8923523,118 0,106.807119 0,93 C0,79.1928813 30.8923523,68 69,68 C107.107648,68 138,79.1928813 138,93 C138,106.807119 107.107648,118 69,118 Z M68,111 C101.68937,111 129,102.717268 129,92.5 C129,82.2827321 101.68937,74 68,74 C34.3106303,74 7,82.2827321 7,92.5 C7,102.717268 34.3106303,111 68,111 Z"
            fill={RING}
          />
          <ellipse cx={68} cy={92.5} rx={61} ry={18.5} fill={SHADE} />
          <g clipPath="url(#mcm-top-clip)">
            <path
              ref={coffeeRef}
              d="M58.9464219,116.999785 C92.6357916,116.999785 124.189078,101.133887 119.946422,98.4997847 C71.0179836,96.9107736 64.8973737,81.2309941 39.7415583,79.6253687 C14.5857429,78.0197434 2,90.7970315 2,98.4997847 C2,108.717053 25.2570521,116.999785 58.9464219,116.999785 Z"
              fill={INK}
              transform="translate(10 10)"
            />
          </g>
        </g>

        {/* face */}
        <g ref={faceRef} transform="translate(356 262)">
          <g ref={eyesClosedRef} stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M6,6 L14,11 L6,16" />
            <path d="M54,6 L46,11 L54,16" />
          </g>
          <g ref={eyesOpenRef} opacity={0}>
            <ellipse cx={16.5} cy={11.5} rx={10.5} ry={11.5} fill="#FFFFFF" />
            <ellipse cx={16} cy={11} rx={7} ry={8} fill={INK} />
            <circle cx={12} cy={8} r={4} fill="#FFFFFF" />
            <ellipse cx={67.5} cy={11.5} rx={10.5} ry={11.5} fill="#FFFFFF" />
            <ellipse cx={67} cy={11} rx={7} ry={8} fill={INK} />
            <circle cx={63} cy={8} r={4} fill="#FFFFFF" />
          </g>
          <path
            ref={mouthARef}
            d="M18,29.25 L53,29.25"
            stroke={INK}
            strokeLinecap="round"
            strokeWidth={5}
            fill="none"
          />
          <g ref={mouthBRef} opacity={0}>
            <circle cx={35} cy={30} r={7} fill={INK} />
          </g>
        </g>
      </g>

      {/* ── sweat drops ── */}
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          ref={dropRefs[i]}
          d="M6.5,18 C9,18 13,15.9705627 13,11 C13,6.02943725 8,0 6.5,0 C5,2.5434972e-16 0,6.02943725 0,11 C0,15.9705627 4,18 6.5,18 Z"
          fill={DROP_BLUE}
          transform="scale(0)"
        />
      ))}
    </svg>
  );
}
