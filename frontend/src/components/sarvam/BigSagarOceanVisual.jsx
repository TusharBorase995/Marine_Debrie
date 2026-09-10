import React, { useState, useEffect } from 'react';

const OCEAN_SLIDES = [
  {
    id: 'ocean-surface',
    title: 'Indian Ocean Swell & Acoustic Telemetry',
    tag: '7,516 KM COASTLINE',
    image: '/images/deep_blue_ocean_waves.jpg',
    desc: 'Sovereign surface monitoring and maritime domain awareness across Arabian Sea and Bay of Bengal.'
  },
  {
    id: 'auv-sonar',
    title: 'Autonomous AUV & Sonar Towfish',
    tag: 'SUBSEA ACOUSTIC SWATH',
    image: '/images/underwater_sonar_towfish.jpg',
    desc: 'Autonomous submersible projecting side-scan acoustic beams to detect seabed hazards.'
  },
  {
    id: 'survey-vessel',
    title: 'Hydrographic Survey Fleet Operations',
    tag: 'SURFACE VESSEL FLEET',
    image: '/images/hero_naval_ocean.jpg',
    desc: 'Continuous bathymetric swath profiling and high-resolution hydrographic mapping.'
  },
  {
    id: 'sonar-waterfall',
    title: 'Side-Scan Sonar Acoustic Waterfall',
    tag: 'ATR DEBRIS CLUSTERS',
    image: '/images/sonar_waterfall_scan.jpg',
    desc: 'Real-time neural segmentation validating submerged pipelines, ghost nets, and hazards.'
  },
  {
    id: 'naval-ops',
    title: 'Sovereign Command & Control Telemetry',
    tag: 'AIR-GAPPED OPERATIONS',
    image: '/images/naval_command_ops.jpg',
    desc: 'Multi-vessel hydrographic data aggregation and bathymetric spatial GIS.'
  }
];

export default function BigSagarOceanVisual({ onLaunchConsole }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Smooth automatic crossfade every 3.8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % OCEAN_SLIDES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const activeSlide = OCEAN_SLIDES[currentIndex];

  return (
    <section className="relative w-full py-16 md:py-24 select-none">
      <div className="w-11/12 max-w-7xl mx-auto flex flex-col items-center">
        
        {/* Subtle Category Badge */}
        <div className="flex items-center gap-2 mb-4 md:mb-6">
          <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
          <span className="font-mono text-[11px] md:text-xs font-semibold uppercase tracking-[2.5px] text-cyan-800">
            SOVEREIGN OCEAN INTELLIGENCE
          </span>
        </div>

        {/* 
          THE GIANT IMAGE-MASKED WORDMARK (Sarvam style: colossal lowercase "sagar" with ocean imagery inside letters) 
          - Generous line-height (leading-[1.18]) and padding so the descender of 'g' is never cropped.
          - No overflow-hidden on text wrappers to allow complete glyph rendering.
        */}
        <div className="relative w-full flex items-center justify-center pt-2 pb-6 md:pb-10">
          
          {/* Sizing anchor with full descender clearance */}
          <span 
            className="font-['Outfit',sans-serif] font-black text-[clamp(4.5rem,19vw,16.5rem)] leading-[1.18] tracking-[-0.04em] lowercase invisible select-none text-center pb-4"
            aria-hidden="true"
          >
            sagar
          </span>

          {/* Stacked crossfading image-clipped text layers */}
          {OCEAN_SLIDES.map((slide, index) => {
            const isActive = index === currentIndex;
            return (
              <div
                key={slide.id}
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-in-out pointer-events-none ${
                  isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                <span
                  className="font-['Outfit',sans-serif] font-black text-[clamp(4.5rem,19vw,16.5rem)] leading-[1.18] tracking-[-0.04em] lowercase select-none text-center block pb-4"
                  style={{
                    backgroundImage: `url(${slide.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 35%',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    filter: 'contrast(1.12) brightness(0.96) saturate(1.1)',
                  }}
                >
                  sagar
                </span>
              </div>
            );
          })}
        </div>

        {/* Seamless Minimalist Perspective Indicator Underneath (No harsh border line) */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 px-2">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-matter text-tx-secondary">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-50/80 font-mono text-[10px] md:text-xs font-semibold tracking-wider text-cyan-800 border border-cyan-100/70">
              {activeSlide.tag}
            </span>
            <span className="font-medium text-tx">{activeSlide.title}</span>
            <span className="hidden md:inline text-tx-tertiary font-normal">• {activeSlide.desc}</span>
          </div>

          {/* Minimal Slide Dots */}
          <div className="flex items-center gap-2 shrink-0">
            {OCEAN_SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'w-7 bg-cyan-700'
                    : 'w-2 bg-st/80 hover:bg-tx-tertiary'
                }`}
                aria-label={`View ${slide.title}`}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
