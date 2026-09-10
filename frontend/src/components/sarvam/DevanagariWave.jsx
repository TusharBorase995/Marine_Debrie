import React, { useEffect, useRef } from 'react';

const INDIC_CHAR_SETS = [
  "अआइउएओकखगघचजटडणतदनपबमयरलवसह",
  "অআইউএওকখগঘচজটডণতদনপবমযরলশসহ",
  "అఆఇఉఎఒకఖగఘచజటడణతదనపబమయరలవసహ",
  "அஆஇஉஎஒகஙசஜடணதநபமயரலவழறன",
  "અઆઇઉએઓકખગઘચજટડણતદનપબમયરલવસહ",
  "ಅಆಇಉಎಒಕಖಗಘಚಜಟಡಣತದನಪಬಮಯರಲವಸಹ",
  "ଅଆଇଉଏଓକଖଗଘଚଜଟଡଣତଦନପବମଯରଲଶସହ",
  "അആഇഉഎഒകഖഗഘചജടഡണതദനപബമയരലവസഹ",
  "ਅਆਇਉਏਓਕਖਗਘਚਜਟਡਣਤਦਨਪਬਮਯਰਲਵਸਹ",
  "ابپتجچدرزسشکگلمنوہی",
  "ᱚᱛᱜᱝᱞᱟᱠᱡᱢᱣᱤᱥᱦᱧᱨᱩᱪᱫᱬᱭᱮᱯᱰᱱᱲᱳᱴᱵᱶᱷ",
  "ꯀꯁꯂꯃꯄꯅꯆꯇꯈꯉꯊꯋꯌꯍꯎꯏꯐꯑꯒꯓ"
].join("");

const FONT_STACK = '"Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Telugu", "Noto Sans Tamil", "Noto Sans Gujarati", "Noto Sans Kannada", "Noto Sans Oriya", "Noto Sans Malayalam", "Noto Sans Gurmukhi", sans-serif';

const STEP_X = 14;
const STEP_Y = 18;
const FONT_SIZE = 12;
const MIN_ALPHA = 0.04;
const MAX_ALPHA = 0.65;
const THICKNESS = 58;

const GRADIENT_STOPS = [
  [0.0, 17, 17, 91],
  [0.25, 51, 51, 204],
  [0.5, 66, 80, 213],
  [0.75, 165, 70, 15],
  [1.0, 230, 101, 27]
];

function interpolateColor(tVal) {
  const a = Math.max(0, Math.min(1, tVal));
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    if (a <= GRADIENT_STOPS[i + 1][0]) {
      const h = (a - GRADIENT_STOPS[i][0]) / (GRADIENT_STOPS[i + 1][0] - GRADIENT_STOPS[i][0]);
      const r = (GRADIENT_STOPS[i][1] + (GRADIENT_STOPS[i + 1][1] - GRADIENT_STOPS[i][1]) * h) | 0;
      const g = (GRADIENT_STOPS[i][2] + (GRADIENT_STOPS[i + 1][2] - GRADIENT_STOPS[i][2]) * h) | 0;
      const b = (GRADIENT_STOPS[i][3] + (GRADIENT_STOPS[i + 1][3] - GRADIENT_STOPS[i][3]) * h) | 0;
      return `rgb(${r},${g},${b})`;
    }
  }
  return "rgb(245,153,112)";
}

function noiseWave(x, y) {
  return (
    Math.sin(x * 0.02 + y * 0.025) * 0.5 +
    Math.sin(x * 0.013 - y * 0.017 + 2.7) * 0.3 +
    Math.sin(x * 0.035 + y * 0.009 + 5.3) * 0.2
  ) * 0.5 + 0.5;
}

export default function DevanagariWave({ canvasClassName = "w-full h-[300px] md:h-[450px]" }) {
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let points = [];

    function handleResize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = Math.ceil(width / STEP_X) + 1;
      const rows = Math.ceil(height / STEP_Y) + 1;
      points = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * STEP_X + STEP_X / 2;
          const y = r * STEP_Y + STEP_Y / 2;
          points.push({
            x,
            y,
            color: interpolateColor(noiseWave(x, y) + (Math.random() - 0.5) * 0.35)
          });
        }
      }
    }

    function animate(time) {
      ctx.clearRect(0, 0, width, height);
      const t = time * 0.001;

      ctx.font = `${FONT_SIZE}px ${FONT_STACK}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const midY = height / 2;
      const amp1 = height * 0.28;
      const amp2 = height * 0.20;
      const charCount = INDIC_CHAR_SETS.length;

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const wave1 = midY + amp1 * Math.sin(pt.x * 0.0045 + t * 0.55);
        const wave2 = midY + amp2 * Math.sin(pt.x * 0.0070 - t * 0.40 + 1.8);
        const dist1 = Math.abs(pt.y - wave1);
        const dist2 = Math.abs(pt.y - wave2);
        const minDist = Math.min(dist1, dist2);

        let alpha = MIN_ALPHA;
        if (minDist < THICKNESS) {
          alpha = Math.max(alpha, MAX_ALPHA * (0.5 + 0.5 * Math.cos(Math.PI * minDist / THICKNESS)));
        }

        // Edge fade out
        const edgeX = Math.min(pt.x / (width * 0.08), (width - pt.x) / (width * 0.08), 1);
        const edgeY = Math.min(pt.y / (height * 0.08), (height - pt.y) / (height * 0.08), 1);
        const edgeFade = Math.max(0, Math.min(edgeX, edgeY));

        ctx.globalAlpha = alpha * edgeFade;
        ctx.fillStyle = pt.color;
        ctx.fillText(INDIC_CHAR_SETS[(i * 17) % charCount], pt.x, pt.y);
      }

      ctx.globalAlpha = 1.0;
      animFrameIdRef.current = requestAnimationFrame(animate);
    }

    handleResize();
    animFrameIdRef.current = requestAnimationFrame(animate);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden select-none pointer-events-none">
      {/* Left/Right Vignette Blending */}
      <div 
        className="hidden md:block absolute inset-y-0 left-0 z-10 w-[20%] pointer-events-none"
        style={{ background: "linear-gradient(to right, #fafafa 15%, transparent)" }}
      />
      <div 
        className="hidden md:block absolute inset-y-0 right-0 z-10 w-[20%] pointer-events-none"
        style={{ background: "linear-gradient(to left, #fafafa 15%, transparent)" }}
      />
      <canvas 
        ref={canvasRef} 
        className={canvasClassName} 
        aria-hidden="true" 
      />
    </div>
  );
}
