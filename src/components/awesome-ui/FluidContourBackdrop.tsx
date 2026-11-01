import React, { useEffect, useRef } from "react";

export interface FluidContourBackdropProps {
  /** Ink RGB normalized [0-1], default [0.17, 0.23, 0.19] */
  inkColor?: [number, number, number];
  /** Paper RGB normalized [0-1], default [0.98, 0.98, 0.96] */
  paperColor?: [number, number, number];
  /** Animation time delta factor, default 0.035 */
  speed?: number;
  /** Whether the contour line reacts to pointer / cursor gravity */
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_ink;
uniform vec3 u_paper;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float cursorHill(vec2 frag, float radius) {
  vec2 d = (frag - u_mouse) / u_res.y;
  return exp(-dot(d, d) / (2.0 * radius * radius));
}

vec4 inkAt(float a) {
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  a = max(0.0, a + (n - 0.5) / 255.0);
  return vec4(u_ink * a, a);
}

void main() {
  vec2 p = gl_FragCoord.xy / u_res.y;
  float f = snoise(vec3(p * 1.6, u_time)) + 0.5 * snoise(vec3(p * 3.4, u_time * 1.3));
  f += 0.45 * cursorHill(gl_FragCoord.xy, 0.16);
  float bands = f * 6.0;
  float line = abs(fract(bands) - 0.5) / fwidth(bands);
  float a = 1.0 - smoothstep(0.0, 1.2, line);
  float index = 1.0 - step(0.5, mod(floor(bands + 0.5), 4.0));
  a *= mix(0.075, 0.14, index);
  gl_FragColor = inkAt(a);
}
`;

export const FluidContourBackdrop: React.FC<FluidContourBackdropProps> = ({
  inkColor = [0.17, 0.23, 0.19],
  paperColor = [0.98, 0.98, 0.96],
  speed = 0.035,
  interactive = true,
  className = "",
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ir, ig, ib] = inkColor;
  const [pr, pg, pb] = paperColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    });
    if (!gl) return;

    gl.getExtension("OES_standard_derivatives");

    function compile(type: number, src: string) {
      const s = gl!.createShader(type);
      if (!s) throw new Error("Failed to create shader");
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        const info = gl!.getShaderInfoLog(s);
        gl!.deleteShader(s);
        throw new Error(info || "Shader compilation failed");
      }
      return s;
    }

    let prog: WebGLProgram | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let buf: WebGLBuffer | null = null;

    try {
      vs = compile(gl.VERTEX_SHADER, VERT);
      fs = compile(gl.FRAGMENT_SHADER, FRAG);
      prog = gl.createProgram();
      if (!prog) return;

      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);

      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );

      const aPos = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, "u_res");
      const uTime = gl.getUniformLocation(prog, "u_time");
      const uMouse = gl.getUniformLocation(prog, "u_mouse");
      const uInk = gl.getUniformLocation(prog, "u_ink");
      const uPaper = gl.getUniformLocation(prog, "u_paper");

      gl.uniform3fv(uInk, inkColor);
      gl.uniform3fv(uPaper, paperColor);

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const scale = Math.min(dpr, 2) * 0.75;

      const resize = () => {
        if (!canvas) return;
        const w = Math.max(1, Math.round(window.innerWidth * scale));
        const h = Math.max(1, Math.round(window.innerHeight * scale));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
      };

      const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };

      const onPointerMove = (e: PointerEvent) => {
        if (!interactive) return;
        mouse.tx = e.clientX * scale;
        mouse.ty = (window.innerHeight - e.clientY) * scale;
        if (mouse.x < -1e3) {
          mouse.x = mouse.tx;
          mouse.y = mouse.ty;
        }
      };

      const onPointerLeave = () => {
        mouse.tx = -1e4;
        mouse.ty = -1e4;
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);

      const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      let t = 17;
      let last = performance.now();
      let raf = 0;

      const draw = () => {
        mouse.x += (mouse.tx - mouse.x) * 0.06;
        mouse.y += (mouse.ty - mouse.y) * 0.06;
        gl.uniform1f(uTime, t);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        t += Math.min(0.05, (now - last) / 1000) * speed;
        last = now;
        draw();
      };

      const start = () => {
        last = performance.now();
        if (reducedQuery.matches) {
          draw();
        } else {
          raf = requestAnimationFrame(loop);
        }
      };

      const stop = () => {
        if (raf) cancelAnimationFrame(raf);
      };

      const onVisibility = () => {
        if (document.hidden) stop();
        else start();
      };

      const onResize = () => {
        resize();
        if (reducedQuery.matches) draw();
      };

      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);

      resize();
      start();

      return () => {
        stop();
        window.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);

        if (buf) gl.deleteBuffer(buf);
        if (prog) {
          if (vs) gl.deleteShader(vs);
          if (fs) gl.deleteShader(fs);
          gl.deleteProgram(prog);
        }
      };
    } catch {
      // Graceful fallback if WebGL is unavailable
    }
  }, [ir, ig, ib, pr, pg, pb, speed, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none w-full h-full z-0 ${className}`}
      style={style}
    />
  );
};
