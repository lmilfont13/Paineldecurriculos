"use client";

import { useEffect, useRef } from "react";

/**
 * Animação de grafo flutuante — nós derivam lentamente e se conectam
 * por linhas que pulsam com a proximidade. Metáfora: talentos e vagas.
 *
 * Com prefers-reduced-motion: desenha snapshot estático (sem loop).
 */
export function GraphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      if (W === 0 || H === 0) return;
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
      // Seed positions spread across the canvas
      for (let i = 0; i < n; i++) {
        const x = W * 0.08 + Math.random() * W * 0.84;
        const y = H * 0.08 + Math.random() * H * 0.84;
        nodes.push({
          ox: x, oy: y,
          phase: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          speed: 0.00028 + Math.random() * 0.00032,
          rx: 30 + Math.random() * 40,
          ry: 20 + Math.random() * 30,
          r: 2 + Math.random() * 1.8,
          x, y,
        });
      }
    }

    function drawFrame() {
      ctx!.clearRect(0, 0, W, H);
      const THRESH = Math.min(W, H) * 0.4;

      // Connections
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
          ctx!.strokeStyle = `rgba(129,18,1,${(t * 0.35).toFixed(3)})`;
          ctx!.lineWidth = t * 1.4;
          ctx!.stroke();
        }
      }

      // Nodes
      for (const n of nodes) {
        const g = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 9);
        g.addColorStop(0, "rgba(158,30,6,0.28)");
        g.addColorStop(1, "rgba(129,18,1,0)");
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r * 9, 0, Math.PI * 2);
        ctx!.fillStyle = g;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(168,34,8,0.9)";
        ctx!.fill();
      }
    }

    function tick() {
      for (const n of nodes) {
        n.phase += n.speed;
        n.phaseY += n.speed * 0.71;
        n.x = n.ox + Math.cos(n.phase) * n.rx;
        n.y = n.oy + Math.sin(n.phaseY) * n.ry;
      }
      drawFrame();
      raf = requestAnimationFrame(tick);
    }

    function start() {
      init();
      if (W === 0 || H === 0) return;
      if (reduced) {
        // Static snapshot — draw once
        drawFrame();
      } else {
        raf = requestAnimationFrame(tick);
      }
    }

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      start();
    });
    ro.observe(canvas.parentElement!);

    start();

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
