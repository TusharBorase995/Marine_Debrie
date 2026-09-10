import React, { useState } from 'react';

const CODE_EXAMPLES = {
  python: `from sagar import SagarOceanAI
from sagar.sonar import SonarStream

# Initialize sovereign maritime intelligence client
client = SagarOceanAI(api_key="SAGAR_SOVEREIGN_KEY")

# Connect to side-scan sonar waterfall stream (Port & Starboard channels)
stream = SonarStream.from_device(device_ip="192.168.1.120", frequency_khz=900)

for scan in stream.read_waterfall():
    detections = client.atr.detect_hazards(
        sonar_frame=scan.imagery,
        bathymetry_depth=scan.depth_m,
        model="sagar-atr:v3",
        confidence_threshold=0.85
    )
    
    for target in detections:
        print(f"Target: {target.classification} | Lat: {target.lat} | Shadow: {target.shadow_m}m")
        target.export_to_gis()`,

  javascript: `import { SagarOceanAI, SonarPipeline } from '@sagar/ocean-sdk';

const client = new SagarOceanAI({
  apiKey: process.env.SAGAR_API_KEY,
  sovereignCluster: "in-west-mumbai"
});

// Stream real-time side-scan sonar returns
const detector = new SonarPipeline(client);
detector.onTargetDetected((target) => {
  console.log(\`[ALERT] \${target.label} detected at depth \${target.depth}m\`);
  detector.pushTelemetryToMap(target.georeference);
});

await detector.startIngestion({ mode: "LIVE_HYDROGRAPHIC_STREAM" });`,

  curl: `curl -X POST "https://api.sagar.ocean.in/v1/sonar/detect" \\
  -H "Authorization: Bearer SAGAR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "survey_id": "SURV-2026-ARABIAN-SEA",
    "frequency_khz": 900,
    "confidence_threshold": 0.85,
    "classification_types": ["sunken_container", "ghost_net", "shipwreck", "unexploded_ordnance"]
  }'`
};

export default function HomeDeveloperSection({ onGetApiKey }) {
  const [selectedLang, setSelectedLang] = useState('python');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_EXAMPLES[selectedLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative mx-auto w-11/12 max-w-6xl py-12 md:py-20">
      <div className="flex flex-col items-center text-center gap-3 mb-10 md:mb-14">
        <h2 className="font-season-mix font-medium text-3xl md:text-5xl text-tx tracking-tight">
          Build anything with<br />Sagar APIs
        </h2>
        <p className="font-matter text-base md:text-lg text-tx-tertiary max-w-xl">
          Everything you need to add sovereign acoustic intelligence and automated target recognition to your marine platforms.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: Interactive Code Sandbox */}
        <div className="relative overflow-hidden border border-st/80 rounded-2xl bg-white p-6 md:p-8 flex flex-col justify-between shadow-soft">
          <div>
            <h3 className="font-matter font-medium text-2xl text-tx tracking-tight mb-4">
              Add <span className="text-cyan-600">Sonar ATR & Target Ingestion</span><br />
              to your vessel in minutes
            </h3>

            {/* Code Box */}
            <div className="overflow-hidden border border-st rounded-xl mt-6">
              {/* Header Tabs */}
              <div className="flex items-center justify-between bg-sf-secondary border-b border-st px-3">
                <div className="flex items-center">
                  {['python', 'javascript', 'curl'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLang(lang)}
                      className={`px-4 py-2.5 font-matter text-xs font-medium capitalize transition-all border-r border-st cursor-pointer ${
                        selectedLang === lang 
                          ? 'bg-white text-cyan-700 font-semibold border-t-2 border-t-cyan-600' 
                          : 'text-tx-tertiary hover:text-tx'
                      }`}
                    >
                      {lang === 'javascript' ? 'JavaScript' : lang === 'curl' ? 'cURL' : 'Python'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-tx-tertiary hover:text-tx font-matter transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Code display */}
              <div className="p-4 bg-white overflow-x-auto max-h-[280px]">
                <pre className="font-mono text-xs text-tx leading-relaxed whitespace-pre">
                  {CODE_EXAMPLES[selectedLang]}
                </pre>
              </div>
            </div>
          </div>

          {/* CTA Banner at bottom */}
          <div className="mt-8 pt-4">
            <button
              onClick={onGetApiKey}
              className="w-full py-3.5 px-6 rounded-full text-white font-matter font-medium text-sm transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)] active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(to bottom, #1e293b 0%, #061325 100%)' }}
            >
              <span>Get your Sagar API key & connect telemetry</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Column: API Suite Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Automated Target Recognition',
              desc: 'Deep learning ATR for side-scan and multibeam sonar identifying debris, ordnance, and seafloor anomalies.',
              badge: 'Sagar-ATR:v3',
              iconColor: '#0284c7',
              icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z'
            },
            {
              title: 'Bathymetric Georeferencing',
              desc: 'Sub-meter spatial projection calculating true latitude, longitude, and slant-range elevation profiles.',
              badge: 'GeoSonar:v2',
              iconColor: '#059669',
              icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
            },
            {
              title: 'Hydrographic Telemetry Stream',
              desc: 'High-throughput low-bandwidth WebSocket protocol engineered for satellite & acoustic modem links.',
              badge: 'Sagar-Link',
              iconColor: '#ea580c',
              icon: 'M13 10V3L4 14h7v7l9-11h-7z'
            },
            {
              title: 'Maritime Sovereign Copilot',
              desc: 'Nautical foundational model for mission planning, fairway analysis, and autonomous hazard alerts.',
              badge: 'Sagar-2B Ocean',
              iconColor: '#6366f1',
              icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
            }
          ].map((card, i) => (
            <div 
              key={i} 
              onClick={onGetApiKey}
              className="p-6 rounded-2xl bg-white border border-st/80 hover:border-cyan-200 transition-all duration-300 shadow-soft hover:shadow-md cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${card.iconColor}15`, color: card.iconColor }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={card.icon} />
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sf-secondary text-tx-secondary border border-st">
                    {card.badge}
                  </span>
                </div>
                <h4 className="font-matter font-medium text-base text-tx mb-2 group-hover:text-cyan-700 transition-colors">
                  {card.title}
                </h4>
                <p className="font-matter text-xs text-tx-tertiary leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="pt-4 mt-2 flex items-center gap-1.5 text-xs font-matter font-medium text-cyan-700 group-hover:translate-x-1 transition-transform">
                <span>View API documentation</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
