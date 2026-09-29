"use client";

import { useEffect, useRef } from "react";

/** Floating-node graph animation — visual metaphor for talent connecting to jobs. */
export function GraphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = 0;

    type Node = {
      ox: number; oy: number;
      phase: number; phaseY: number;
      speed: number; rx: number; ry: number;
      r: number; x: number; y: number;
    };
    let nodes: Node[] = [];

    function init() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas!.width = W * DPR;
      canvas!.height = H * DPR;
      canvas!.style.width = W + "px";
      canvas!.style.height = H + "px";
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildNodes();
    }

    function buildNodes() {
      const n = Math.max(7, Math.min(14, Math.round((W * H) / 38000)));
      nodes = [];
      for (let i = 0; i < n; i++) {
        const x = W * 0.05 + Math.random() * W * 0.9;
        const y = H * 0.05 + Math.random() * H * 0.9;
        nodes.push({
          ox: x, oy: y,
          phase: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          speed: 0.00028 + Math.random() * 0.00032,
          rx: 30 + Math.random() * 40,
          ry: 20 + Math.random() * 30,
          r: 1.8 + Math.random() * 1.6,
          x, y,
        });
      }
    }

    function tick() {
      ctx!.clearRect(0, 0, W, H);
      const THRESH = Math.min(W, H) * 0.38;

      for (const n of nodes) {
        n.phase += n.speed;
        n.phaseY += n.speed * 0.71;
        n.x = n.ox + Math.cos(n.phase) * n.rx;
        n.y = n.oy + Math.sin(n.phaseY) * n.ry;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= THRESH) continue;
          const t = Math.pow(1 - d / THRESH, 1.6);
          ctx!.beginPath();
          ctx!.moveTo(nodes[i].x, nodes[i].y);
          ctx!.lineTo(nodes[j].x, nodes[j].y);
          ctx!.strokeStyle = `rgba(129,18,1,${(t * 0.3).toFixed(3)})`;
          ctx!.lineWidth = t * 1.3;
          ctx!.stroke();
        }
      }

      for (const n of nodes) {
        const g = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 8);
        g.addColorStop(0, "rgba(129,18,1,0.22)");
        g.addColorStop(1, "rgba(129,18,1,0)");
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r * 8, 0, Math.PI * 2);
        ctx!.fillStyle = g;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(158,30,6,0.85)";
        ctx!.fill();
      }

      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      init();
      raf = requestAnimationFrame(tick);
    });
    ro.observe(canvas.parentElement!);

    init();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
