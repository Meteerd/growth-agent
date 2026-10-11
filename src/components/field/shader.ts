// Domain-warped fbm flow field rendered as faint topographic iso-lines over a spectral haze.
// Full-screen triangle from gl_VertexID: no buffers.
export const vertex = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform float uTime;
uniform float uActivity;
uniform float uVortex;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform vec3 uAccent;
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

  // cursor bends the flow locally
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
  vec2 d = uv - m;
  float infl = exp(-dot(d, d) * 7.0);
  uv -= d * 0.18 * infl;

  // vortex: swirl toward the centre and pull inward
  float r = length(uv);
  float ang = uVortex * 7.0 * exp(-r * 1.2);
  float c = cos(ang), s = sin(ang);
  uv = mat2(c, -s, s, c) * uv * (1.0 + uVortex * 1.4);

  float speed = 0.025 + 0.11 * uActivity;
  float t = uTime * speed;
  vec2 p = uv * 1.6 + vec2(3.1, 1.7);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 w = vec2(fbm(p + 2.6 * q + vec2(1.7, 9.2) + 0.7 * t), fbm(p + 2.6 * q + vec2(8.3, 2.8) - 0.6 * t));
  float f = smoothstep(0.18, 0.82, fbm(p + 2.8 * w));

  vec3 ink = vec3(0.024, 0.027, 0.039);
  vec3 violet = vec3(0.357, 0.235, 1.0);
  vec3 cyan = vec3(0.235, 0.878, 1.0);
  vec3 bone = vec3(0.925, 0.906, 0.867);

  float haze = smoothstep(0.3, 1.0, f);
  vec3 col = ink;
  vec3 hazeCol = mix(vec3(0.32, 0.36, 0.48), violet, 0.3);
  col += hazeCol * haze * haze * (0.07 + 0.16 * uActivity);
  col += cyan * smoothstep(0.6, 1.25, length(w)) * (0.015 + 0.07 * uActivity);

  // iso-lines: the "star chart" contours
  float bands = f * 12.0;
  float iso = abs(fract(bands) - 0.5);
  float aa = fwidth(bands) * 1.2;
  float line = 1.0 - smoothstep(0.0, aa + 0.002, iso - 0.0);
  float lineMask = smoothstep(0.15, 0.7, f);
  col += bone * line * lineMask * (0.045 + 0.08 * uActivity);
  // accent glints on the strongest ridges, only when the agent works
  float ridge = smoothstep(0.7, 0.95, f) * line;
  col += uAccent * ridge * (0.02 + 0.5 * uActivity * uActivity) ;
  col += uAccent * infl * 0.025 * (0.3 + uActivity);

  // soft diagonal light beam behind the hero (depth from light, not from grey surfaces)
  float beam = exp(-pow(uv.x * 0.55 - uv.y * 0.85 + 0.05, 2.0) * 9.0) * smoothstep(-0.6, 0.5, uv.y);
  col += vec3(0.5, 0.52, 0.62) * beam * (0.03 + 0.03 * uActivity);
  col += bone * line * beam * 0.04;

  // vignette and top light
  float vig = smoothstep(1.25, 0.2, length((vUv - vec2(0.5, 0.42)) * vec2(aspect * 0.8, 1.1)));
  col *= 0.45 + 0.55 * vig;
  col += vec3(0.02, 0.022, 0.03) * smoothstep(0.6, 1.0, vUv.y);
  col = mix(col, ink, uVortex * smoothstep(0.0, 0.6, r) * 0.6);

  outColor = vec4(col, 1.0);
}
`;
