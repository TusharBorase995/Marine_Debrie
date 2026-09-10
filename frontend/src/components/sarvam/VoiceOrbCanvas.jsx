import React, { useEffect, useRef } from 'react';

// Sarvam AI Voice Orb WebGL Parameters
const DEFAULT_PARAMS = {
  loop: 7.2,
  radius: 0.362,
  hotX: 0.27,
  hotY: 0.02,
  spread: 0.9,
  pulse: 1.0,
  warpAmp: 0.55,
  warpFreq: 1.8,
  evo: 3.0,
  shapeAmt: 0.7,
  shapeLift: 0.55,
  shapeSoft: 0.13,
  shapeScale: 1.6,
  glow: 0.3,
  waveSize: 0.08,
  waveBlur: 0.37,
  waveFreq: 2.2,
  symbol: 0.04,
  lens: 0.22,
  rimAmt: 0.7,
  rimPow: 3.5,
  grain: 0.008,
  reactHot: 0.55,
  reactLens: 0.45,
  reactWave: 0.8,
};

const VERTEX_SHADER = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uPhase;
uniform vec3  uCore, uBody, uRim;
uniform float uRadius, uSpread, uPulse;
uniform vec2  uHot;
uniform float uWarpAmp, uWarpFreq, uEvo;
uniform float uShapeAmt, uShapeLift, uShapeSoft, uShapeScale;
uniform float uGlow, uWaveOpacity, uWaveSize, uWaveBlur, uWaveFreq;
uniform float uLens, uRimAmt, uRimPow, uGrain;

const float TAU = 6.28318530718;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float phash(vec3 i, float per) {
  i.z = mod(i.z, per);
  return hash(i);
}

float vnoise(vec3 x, float per) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(phash(i + vec3(0.0,0.0,0.0), per), phash(i + vec3(1.0,0.0,0.0), per), f.x),
        mix(phash(i + vec3(0.0,1.0,0.0), per), phash(i + vec3(1.0,1.0,0.0), per), f.x), f.y),
    mix(mix(phash(i + vec3(0.0,0.0,1.0), per), phash(i + vec3(1.0,0.0,1.0), per), f.x),
        mix(phash(i + vec3(0.0,1.0,1.0), per), phash(i + vec3(1.0,1.0,1.0), per), f.x), f.y),
    f.z);
}

float fbm(vec3 p, float per) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p, per);
    p = p * 2.0; p.xy += vec2(17.3, 11.7);
    per *= 2.0; a *= 0.5;
  }
  return s;
}

float breath(float ph) {
  return 0.66 * sin(TAU * 6.0 * ph - 1.63) + 0.34 * sin(TAU * 3.0 * ph - 2.64);
}

void main() {
  vec2  p  = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float R  = uRadius;
  float d  = length(p) / R;
  float bl = breath(uPhase) * uPulse;

  float turns  = max(uEvo, 1.0);
  float sturns = turns * 2.0;

  float z = sqrt(max(0.0, 1.0 - min(d, 1.0) * min(d, 1.0)));
  vec2  q = (p / R) * (1.0 - uLens * z);

  vec2 w = vec2(
    fbm(vec3(q * uWarpFreq,        uPhase * turns),        turns),
    fbm(vec3(q * uWarpFreq + 31.4, uPhase * turns + 11.7), turns)
  ) - 0.5;
  vec2 qw = q + w * uWarpAmp;

  float gd = length(qw - uHot) / (uSpread * (1.0 + 0.06 * bl));
  float g  = pow(1.0 - smoothstep(0.0, 1.0, gd), 1.2);
  vec3 base = mix(uBody, uCore, clamp(g * (0.92 + 0.16 * bl), 0.0, 1.0));

  vec2  drift = vec2(sin(TAU * uPhase), cos(TAU * uPhase)) * 0.22;
  float n     = fbm(vec3(qw * uShapeScale + drift + 3.0, uPhase * sturns), sturns);
  float form  = smoothstep(0.5 - uShapeSoft, 0.5 + uShapeSoft, n);
  vec3 shapeCol = mix(base, min(uCore * 1.06, vec3(1.0)), uShapeLift);
  vec3 col = mix(base, shapeCol, form * uShapeAmt);

  col = mix(col, uRim, pow(clamp(d, 0.0, 1.0), uRimPow) * uRimAmt);
  col += uCore * max(g - 0.5, 0.0) * uGlow * 0.35;

  float aa  = 1.2 / (uRes.y * R);
  float cov = 1.0 - smoothstep(1.0 - aa, 1.0, d);

  float ang   = atan(p.y, p.x);
  vec2  ring  = vec2(cos(ang), sin(ang)) * uWaveFreq;
  float wv    = fbm(vec3(ring, uPhase * turns), turns);
  float reach = max(uWaveSize * (0.45 + 1.1 * wv), 0.001);
  float fp    = mix(3.0, 0.6, clamp(uWaveBlur, 0.0, 1.0));
  float ft    = max(d - 1.0, 0.0) / reach;
  float wave  = clamp(exp(-pow(ft, fp)) * uWaveOpacity, 0.0, 1.0) * (1.0 - cov);
  vec3  waveCol = mix(uRim, uCore, 0.5);

  vec3  rgb = col * cov + waveCol * wave;
  float a   = min(cov + wave, 1.0);
  rgb += (hash(vec3(gl_FragCoord.xy, floor(uTime * 24.0))) - 0.5) * uGrain * a;
  gl_FragColor = vec4(rgb, a);
}
`;

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

export default function VoiceOrbCanvas({ 
  isPlaying = false,
  onTogglePlaying,
  agentName = "Simran",
  agentColorTheme = { core: "#C7D2FE", body: "#4338CA", rim: "#1E1B4B" },
  className = ""
}) {
  const canvasRef = useRef(null);
  const audioLevelRef = useRef(0);
  const animFrameIdRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: false }) ||
               canvas.getContext("experimental-webgl", { alpha: true });

    if (!gl) return;

    function createShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Quad buffer
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uList = [
      "uRes", "uTime", "uPhase", "uCore", "uBody", "uRim",
      "uRadius", "uHot", "uSpread", "uPulse", "uWarpAmp", "uWarpFreq",
      "uEvo", "uShapeAmt", "uShapeLift", "uShapeSoft", "uShapeScale",
      "uGlow", "uWaveOpacity", "uWaveSize", "uWaveBlur", "uWaveFreq",
      "uLens", "uRimAmt", "uRimPow", "uGrain"
    ];
    const uMap = {};
    for (const name of uList) {
      uMap[name] = gl.getUniformLocation(program, name);
    }

    // Initialize static uniforms
    gl.uniform1f(uMap.uRadius, DEFAULT_PARAMS.radius);
    gl.uniform1f(uMap.uSpread, DEFAULT_PARAMS.spread);
    gl.uniform1f(uMap.uPulse, DEFAULT_PARAMS.pulse);
    gl.uniform1f(uMap.uWarpAmp, DEFAULT_PARAMS.warpAmp);
    gl.uniform1f(uMap.uWarpFreq, DEFAULT_PARAMS.warpFreq);
    gl.uniform1f(uMap.uEvo, DEFAULT_PARAMS.evo);
    gl.uniform1f(uMap.uShapeAmt, DEFAULT_PARAMS.shapeAmt);
    gl.uniform1f(uMap.uShapeLift, DEFAULT_PARAMS.shapeLift);
    gl.uniform1f(uMap.uShapeSoft, DEFAULT_PARAMS.shapeSoft);
    gl.uniform1f(uMap.uShapeScale, DEFAULT_PARAMS.shapeScale);
    gl.uniform1f(uMap.uGlow, DEFAULT_PARAMS.glow);
    gl.uniform1f(uMap.uWaveFreq, DEFAULT_PARAMS.waveFreq);
    gl.uniform1f(uMap.uRimAmt, DEFAULT_PARAMS.rimAmt);
    gl.uniform1f(uMap.uRimPow, DEFAULT_PARAMS.rimPow);
    gl.uniform1f(uMap.uGrain, DEFAULT_PARAMS.grain);

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0, height = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (width !== targetW || height !== targetH) {
        width = targetW;
        height = targetH;
        canvas.width = targetW;
        canvas.height = targetH;
        gl.viewport(0, 0, targetW, targetH);
      }
    }
    resize();

    let lastTime = performance.now();
    let accumulatedTime = 0;
    let smoothAudio = 0;

    function render(currentTime) {
      animFrameIdRef.current = requestAnimationFrame(render);
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      resize();

      const targetAudio = isPlaying 
        ? 0.35 + 0.45 * Math.sin(currentTime * 0.007) * Math.cos(currentTime * 0.013)
        : 0;
      smoothAudio += (targetAudio - smoothAudio) * 0.08;
      audioLevelRef.current = smoothAudio;

      accumulatedTime += dt * (isPlaying ? 1.4 : 0.8);
      const phase = (accumulatedTime / DEFAULT_PARAMS.loop) % 1.0;

      const coreRGB = hexToRgb(agentColorTheme.core || "#C7D2FE");
      const bodyRGB = hexToRgb(agentColorTheme.body || "#4338CA");
      const rimRGB  = hexToRgb(agentColorTheme.rim  || "#1E1B4B");

      gl.uniform2f(uMap.uRes, canvas.width, canvas.height);
      gl.uniform1f(uMap.uTime, accumulatedTime);
      gl.uniform1f(uMap.uPhase, phase);
      gl.uniform3fv(uMap.uCore, coreRGB);
      gl.uniform3fv(uMap.uBody, bodyRGB);
      gl.uniform3fv(uMap.uRim, rimRGB);

      gl.uniform1f(uMap.uPulse, DEFAULT_PARAMS.pulse + smoothAudio * DEFAULT_PARAMS.reactHot);
      gl.uniform2f(uMap.uHot, DEFAULT_PARAMS.hotX, DEFAULT_PARAMS.hotY - smoothAudio * 0.06);
      gl.uniform1f(uMap.uLens, DEFAULT_PARAMS.lens + smoothAudio * DEFAULT_PARAMS.reactLens);
      gl.uniform1f(uMap.uWaveOpacity, smoothAudio * DEFAULT_PARAMS.reactWave * 0.45);
      gl.uniform1f(uMap.uWaveSize, DEFAULT_PARAMS.waveSize + smoothAudio * 0.08);
      gl.uniform1f(uMap.uWaveBlur, DEFAULT_PARAMS.waveBlur);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, agentColorTheme]);

  return (
    <div className={`relative aspect-square w-full max-w-[280px] sm:max-w-[320px] mx-auto flex items-center justify-center ${className}`}>
      {/* Background motif watermark */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.05]" 
        style={{
          backgroundImage: 'radial-gradient(circle, #1e2033 1px, transparent 1px)',
          backgroundSize: '12px 12px'
        }} 
        aria-hidden="true" 
      />

      {/* WebGL Shader Canvas */}
      <canvas 
        ref={canvasRef} 
        className="block h-full w-full relative z-0 filter drop-shadow-[0_12px_28px_rgba(79,70,229,0.15)]"
        aria-label="Interactive sovereign voice AI agent orb"
      />

      {/* Interactive Floating Center Button */}
      <button 
        type="button"
        onClick={onTogglePlaying}
        className={`group absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center h-[42px] px-6 whitespace-nowrap font-matter font-medium text-sm tracking-wide rounded-full backdrop-blur-md cursor-pointer transition-all duration-300 shadow-md ${
          isPlaying 
            ? 'bg-slate-900/90 text-white shadow-lg shadow-indigo-500/20 scale-105 border border-indigo-400/40' 
            : 'bg-white/95 hover:bg-white text-[#1e2033] hover:scale-105 border border-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_16px_rgba(0,0,0,0.08)]'
        }`}
      >
        <span className="flex items-center gap-2">
          {isPlaying ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Pause</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-sr-indigo-600 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Start Speaking</span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
