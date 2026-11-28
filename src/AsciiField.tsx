import { useEffect, useRef } from "react";

const GLYPHS = "⌁⌘⌖⌗⌬⍟⎔⏣⋄⋆◇◈⟡⟢⟣";

export function AsciiField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrowScreen = window.matchMedia("(max-width: 760px)");
    if (reducedMotion.matches || narrowScreen.matches) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let lastPaint = 0;
    const columns: Array<{ x: number; y: number; speed: number; glyph: string; alpha: number }> = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      columns.length = 0;
      const count = Math.min(42, Math.floor(width / 34));
      for (let index = 0; index < count; index += 1) {
        columns.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speed: 0.08 + Math.random() * 0.22,
          glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          alpha: 0.07 + Math.random() * 0.08,
        });
      }
    };

    const draw = (timestamp: number) => {
      frame = window.requestAnimationFrame(draw);
      if (timestamp - lastPaint < 90) return;
      lastPaint = timestamp;
      context.clearRect(0, 0, width, height);
      context.font = "12px 'DM Mono', monospace";
      context.textAlign = "center";
      for (const particle of columns) {
        context.fillStyle = `rgba(174, 151, 255, ${particle.alpha})`;
        context.fillText(particle.glyph, particle.x, particle.y);
        particle.y += particle.speed;
        if (particle.y > height + 24) {
          particle.y = -24;
          particle.x = Math.random() * width;
        }
      }
    };

    resize();
    frame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="ascii-field" aria-hidden="true" />;
}