"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT_RGB, useField } from "@/lib/client/field";
import { fragment, vertex } from "./shader";

const UNIFORMS = ["uTime", "uActivity", "uVortex", "uRes", "uMouse", "uAccent"] as const;

function program(gl: WebGL2RenderingContext) {
  const prog = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  return prog;
}

/** Waits for the link without blocking the main thread when KHR_parallel_shader_compile exists. */
function whenLinked(gl: WebGL2RenderingContext, prog: WebGLProgram, done: () => void, fail: (e: string) => void) {
  const ext = gl.getExtension("KHR_parallel_shader_compile");
  const check = () => {
    if (ext && !gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR)) return void setTimeout(check, 50);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fail(gl.getProgramInfoLog(prog) ?? "link failed");
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL method named useProgram, not a React hook
    gl.useProgram(prog);
    done();
  };
  check();
}

// Field shader on raw WebGL2. The field is soft, so it renders below device resolution
// (DPR capped at 1.5, then scaled 0.75). rAF stops when the tab is hidden; we also skip work then.
export default function FieldCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;
    const prog = program(gl);
    let alive = true;
    let cleanup = () => {};
    const start = () => {
      if (!alive) return;
      const loc = Object.fromEntries(UNIFORMS.map((u) => [u, gl.getUniformLocation(prog, u)])) as Record<
        (typeof UNIFORMS)[number],
        WebGLUniformLocation | null
      >;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
      const resize = () => {
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      resize();

      const s = {
        time: 0,
        activity: useField.getState().activity,
        vortex: 0,
        mx: 0.5,
        my: 0.6,
        tx: 0.5,
        ty: 0.6,
        accent: [...ACCENT_RGB.signal],
      };
      const move = (e: PointerEvent) => {
        s.tx = e.clientX / window.innerWidth;
        s.ty = 1 - e.clientY / window.innerHeight;
      };
      window.addEventListener("pointermove", move, { passive: true });

      let raf = 0;
      let last = performance.now();
      let frames = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (document.hidden) return;
        const f = useField.getState();
        const k = 1 - Math.exp(-dt * 2.2); // frame-rate independent easing
        s.time += dt;
        s.activity += (f.activity - s.activity) * k;
        s.vortex += (f.vortex - s.vortex) * (1 - Math.exp(-dt * 4));
        s.mx += (s.tx - s.mx) * (1 - Math.exp(-dt * 3));
        s.my += (s.ty - s.my) * (1 - Math.exp(-dt * 3));
        const a = ACCENT_RGB[f.accent];
        for (let i = 0; i < 3; i++) s.accent[i] += (a[i] - s.accent[i]) * k;
        gl.uniform1f(loc.uTime, s.time);
        gl.uniform1f(loc.uActivity, s.activity);
        gl.uniform1f(loc.uVortex, s.vortex);
        gl.uniform2f(loc.uRes, canvas.width, canvas.height);
        gl.uniform2f(loc.uMouse, s.mx, s.my);
        gl.uniform3f(loc.uAccent, s.accent[0], s.accent[1], s.accent[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (++frames === 2) setReady(true);
      };
      raf = requestAnimationFrame(frame);
      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("pointermove", move);
      };
    };
    whenLinked(gl, prog, start, (e) => console.warn("field shader disabled:", e));

    return () => {
      alive = false;
      cleanup();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      data-field={ready ? "ready" : "loading"}
      className="absolute inset-0 h-full w-full transition-opacity duration-[1200ms] ease-out"
      style={{ opacity: ready ? 1 : 0 }}
    />
  );
}
