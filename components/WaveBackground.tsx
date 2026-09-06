"use client";

import { useEffect, useRef } from "react";

export default function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Wave 1 - Top (Light Blue)
      ctx.beginPath();
      ctx.moveTo(0, H * 0.28);
      ctx.bezierCurveTo(W * 0.12, H * 0.12, W * 0.28, H * 0.22, W * 0.42, H * 0.32);
      ctx.bezierCurveTo(W * 0.58, H * 0.44, W * 0.68, H * 0.52, W * 0.72, H * 0.48);
      ctx.bezierCurveTo(W * 0.8,  H * 0.42, W * 0.9,  H * 0.3,  W,        H * 0.38);
      ctx.lineTo(W, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fillStyle = "#d4e6ff";   // Light Blue
      ctx.fill();

      // Wave 2 - Bottom (Light Yellow)
      ctx.beginPath();
      ctx.moveTo(0, H * 0.55);
      ctx.bezierCurveTo(W * 0.15, H * 0.45, W * 0.32, H * 0.62, W * 0.5,  H * 0.52);
      ctx.bezierCurveTo(W * 0.65, H * 0.44, W * 0.78, H * 0.35, W,         H * 0.5);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = "#c99c49";   // Light Yellow
      ctx.fill();
    }

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        display: "block",
      }}
    />
  );
}