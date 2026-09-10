import React, { useState } from 'react';
import VoiceOrbCanvas from './VoiceOrbCanvas';

const ACOUSTIC_SCENARIOS = [
  {
    id: 'subsea-hazard',
    title: 'Subsea Hazard Alert',
    theme: { core: '#BAE6FD', body: '#0284C7', rim: '#0B3B60' },
    speakerName: 'Sagar-Copilot',
    dialogue: [
      { sender: 'Sagar-Copilot', type: 'agent', text: 'Attention Operator: Side-scan pass at 18.5324° N detected an acoustic shadow indicative of an uncharted submerged metallic hazard at 24m depth.' },
      { sender: 'Lead Hydrographer', type: 'user', text: 'Confirm dimensions and calculate distance from primary shipping fairway.' },
      { sender: 'Sagar-Copilot', type: 'agent', text: 'Target length: 14.2m, shadow height: 3.1m. Proximity to fairway is 320m east. Georeferenced marker logged to GIS telemetry map.' }
    ]
  },
  {
    id: 'debris-classification',
    title: 'Marine Debris ATR',
    theme: { core: '#FED7AA', body: '#EA580C', rim: '#431407' },
    speakerName: 'ATR-Neural',
    dialogue: [
      { sender: 'ATR-Neural', type: 'agent', text: 'Seabed scan cluster 04 classified as entangled ghost netting (Confidence: 97.8%). Potential navigation hazard for submersibles.' },
      { sender: 'Lead Hydrographer', type: 'user', text: 'Export target bounding box and compute multi-pass confidence score.' },
      { sender: 'ATR-Neural', type: 'agent', text: 'Multi-pass correlation completed. Target ground-truthed across Port & Starboard channels with 99.1% consistency.' }
    ]
  },
  {
    id: 'survey-optimization',
    title: 'AUV Mission Waypoint',
    theme: { core: '#A7F3D0', body: '#059669', rim: '#064E3B' },
    speakerName: 'Sagar-Nav',
    dialogue: [
      { sender: 'Sagar-Nav', type: 'agent', text: 'Survey swath coverage at 84% in Sector Charlie. Bathymetric contour indicates 8% acoustic nadir gap.' },
      { sender: 'Lead Hydrographer', type: 'user', text: 'Recalculate AUV lawnmower track with 20m overlap to close coverage gap.' },
      { sender: 'Sagar-Nav', type: 'agent', text: 'Waypoint route updated. Transmitting acoustic telemetry packet to autonomous vehicle.' }
    ]
  }
];

const SONAR_BANDS = [
  { code: 'hf-900', name: 'High-Freq 900 kHz', desc: 'Ultra-high resolution for centimeter debris and cable detection', sampleText: 'Target Return: High acoustic reflectivity. Sharp acoustic shadow revealing cylindrical drum casing at 18m slant range.' },
  { code: 'mf-450', name: 'Mid-Freq 450 kHz', desc: 'Optimal balance of 150m swath width and target discrimination', sampleText: 'Target Return: Distinct rectilinear shadow indicating sunken shipping container. Seabed scouring observed on leeward face.' },
  { code: 'lf-100', name: 'Low-Freq 100 kHz', desc: 'Deep-water wide-area reconnaissance up to 500m range', sampleText: 'Target Return: Broad acoustic anomaly spanning 45m. Probable shipwreck hull with partial sediment burial.' },
  { code: 'fls-700', name: 'Forward-Looking Sonar', desc: 'Real-time obstacle avoidance and navigation safety', sampleText: 'Target Return: Emergent pinnacle 12m ahead of transducer. Recommend 5-degree starboard course correction.' },
];

const ATR_MODELS = [
  { id: 'sagar-net', name: 'Sagar-ATR v3', badge: 'Production ATR' },
  { id: 'shadow-seg', name: 'ShadowSeg v2', badge: 'Bathymetric' },
  { id: 'debris-yolo', name: 'MarineYOLO-X', badge: 'Real-Time' },
  { id: 'nav-guard', name: 'NavGuard v1', badge: 'Defense' },
];

export default function PlaygroundShowcase({ onNavigateDashboard }) {
  const [activeTab, setActiveTab] = useState('acoustic-copilot');
  
  // Acoustic Copilot State
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const [isOrbPlaying, setIsOrbPlaying] = useState(false);
  const [chatMessages, setChatMessages] = useState(ACOUSTIC_SCENARIOS[0].dialogue);

  // Sonar Band State
  const [selectedBand, setSelectedBand] = useState(SONAR_BANDS[0]);
  const [selectedModel, setSelectedModel] = useState(ATR_MODELS[0]);
  const [sonarQueryText, setSonarQueryText] = useState(SONAR_BANDS[0].sampleText);
  const [isSonarPlaying, setIsSonarPlaying] = useState(false);

  // STT State
  const [isVoiceCmdPlaying, setIsVoiceCmdPlaying] = useState(false);

  // Vision State
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);

  const handleScenarioChange = (index) => {
    setActiveScenarioIndex(index);
    setChatMessages(ACOUSTIC_SCENARIOS[index].dialogue);
    setIsOrbPlaying(false);
  };

  const handleBandChange = (band) => {
    setSelectedBand(band);
    setSonarQueryText(band.sampleText);
    setIsSonarPlaying(false);
  };

  const currentScenario = ACOUSTIC_SCENARIOS[activeScenarioIndex];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
      <div className="relative w-full rounded-2xl md:rounded-3xl border border-st/80 bg-white/70 backdrop-blur-xl shadow-2xl p-1.5 md:p-2.5 transition-all">
        
        {/* Tab Headers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1 p-1 bg-sf-secondary/80 rounded-xl md:rounded-2xl border border-st/40">
          {[
            { id: 'acoustic-copilot', label: 'Acoustic Copilot', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
            { id: 'sonar-atr', label: 'Sonar ATR Models', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
            { id: 'voice-command', label: 'Hydrographic Speech', icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' },
            { id: 'waterfall-vision', label: 'Side-Scan Vision ATR', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg md:rounded-xl font-matter text-sm font-medium transition-all duration-200 cursor-pointer select-none ${
                  active 
                    ? 'bg-white text-sr-indigo-600 shadow-sm border border-st/60' 
                    : 'text-tx-tertiary hover:text-tx hover:bg-white/40'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div className="relative mt-2 min-h-[460px] md:min-h-[520px] bg-sf rounded-xl md:rounded-[20px] border border-st/50 overflow-hidden p-4 sm:p-6 md:p-8">
          
          {/* TAB 1: ACOUSTIC COPILOT & SHADER ORB */}
          {activeTab === 'acoustic-copilot' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
              
              {/* Left Column: Mission Scenarios */}
              <div className="lg:col-span-3 flex flex-col gap-2 border-b lg:border-b-0 lg:border-r border-st/60 pb-6 lg:pb-0 lg:pr-6">
                <span className="font-matter text-xs font-semibold uppercase tracking-wider text-tx-tertiary mb-2">
                  Tactical Operational Scenarios
                </span>
                {ACOUSTIC_SCENARIOS.map((scen, idx) => {
                  const selected = activeScenarioIndex === idx;
                  return (
                    <button
                      key={scen.id}
                      type="button"
                      onClick={() => handleScenarioChange(idx)}
                      className={`text-left p-3.5 rounded-xl transition-all cursor-pointer border flex flex-col gap-1 ${
                        selected 
                          ? 'bg-white border-sr-indigo-200 shadow-sm ring-1 ring-sr-indigo-400/20' 
                          : 'bg-sf-secondary/60 hover:bg-white border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-matter font-medium text-sm ${selected ? 'text-sr-indigo-600' : 'text-tx'}`}>
                          {scen.title}
                        </span>
                        <span className="text-xs text-tx-tertiary">{scen.speakerName}</span>
                      </div>
                      <span className="text-xs text-tx-tertiary line-clamp-1">
                        {scen.dialogue[0].text}
                      </span>
                    </button>
                  );
                })}

                <div className="mt-auto pt-6 hidden lg:block">
                  <div className="p-3.5 bg-sr-indigo-50/70 rounded-xl border border-sr-indigo-100">
                    <p className="text-xs text-sr-indigo-900 font-medium mb-1">
                      Sagar Sovereign Subsea AI
                    </p>
                    <p className="text-[11px] text-sr-indigo-700/80 leading-relaxed">
                      Instant acoustic shadow verification, false-positive filtering, and autonomous fairway telemetry.
                    </p>
                  </div>
                </div>
              </div>

              {/* Center Column: Interactive WebGL Fluid Acoustic Orb */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center relative p-4 bg-sf-secondary/30 rounded-2xl border border-st/40">
                <div className="text-center mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-st/80 text-xs font-matter text-tx font-medium shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                    Sonar Stream: {currentScenario.speakerName}
                  </span>
                </div>

                {/* THE FLUID WEBGL ACOUSTIC ORB ENGINE */}
                <VoiceOrbCanvas 
                  isPlaying={isOrbPlaying}
                  onTogglePlaying={() => setIsOrbPlaying(!isOrbPlaying)}
                  agentName={currentScenario.speakerName}
                  agentColorTheme={currentScenario.theme}
                />

                <p className="text-xs text-tx-tertiary font-matter text-center mt-3">
                  {isOrbPlaying ? 'Transmitting acoustic pulse harmonics to bridge...' : 'Click "Start Speaking" to simulate live acoustic copilot link.'}
                </p>
              </div>

              {/* Right Column: Live Dialogue Stream */}
              <div className="lg:col-span-4 flex flex-col h-full border-t lg:border-t-0 lg:border-l border-st/60 pt-6 lg:pt-0 lg:pl-6">
                <div className="flex items-center justify-between pb-3 border-b border-st/50">
                  <span className="font-matter text-xs font-semibold uppercase tracking-wider text-tx-tertiary">
                    Acoustic Telemetry Stream
                  </span>
                  <span className="text-[11px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full font-medium">
                    Live Sonar Feed
                  </span>
                </div>

                <div className="flex-1 flex flex-col gap-3 py-4 overflow-y-auto max-h-[300px] lg:max-h-none">
                  {chatMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-matter leading-relaxed ${
                        msg.type === 'agent' 
                          ? 'mr-auto bg-sky-50 text-sky-950 border border-sky-100 rounded-bl-xs' 
                          : 'ml-auto bg-slate-900 text-slate-100 border border-slate-800 rounded-br-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-semibold mb-1 opacity-70">
                        <span>{msg.sender}</span>
                      </div>
                      <p>{msg.text}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 mt-auto">
                  <button
                    onClick={onNavigateDashboard}
                    className="w-full py-2.5 px-4 bg-[#2a2c33] hover:bg-[#1e2033] text-white rounded-full text-xs font-matter font-medium flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <span>Launch Mission Console</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: SONAR ATR MODELS */}
          {activeTab === 'sonar-atr' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-st/60">
                {/* Sonar Band Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {SONAR_BANDS.map((band) => (
                    <button
                      key={band.code}
                      onClick={() => handleBandChange(band)}
                      className={`px-3 py-1.5 rounded-full text-xs font-matter transition-all cursor-pointer ${
                        selectedBand.code === band.code 
                          ? 'bg-sr-indigo-600 text-white font-medium shadow-xs' 
                          : 'bg-white hover:bg-sf-secondary text-tx-secondary border border-st/80'
                      }`}
                    >
                      {band.name}
                    </button>
                  ))}
                </div>

                {/* Model Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-tx-tertiary">Pipeline:</span>
                  <div className="flex gap-1">
                    {ATR_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model)}
                        className={`px-3 py-1 rounded-lg text-xs font-matter transition-all cursor-pointer ${
                          selectedModel.id === model.id 
                            ? 'bg-white text-sr-indigo-600 font-semibold border border-sr-indigo-300 shadow-2xs' 
                            : 'bg-sf-secondary/70 text-tx-tertiary hover:text-tx'
                        }`}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Acoustic Text Area */}
              <div className="relative">
                <textarea
                  value={sonarQueryText}
                  onChange={(e) => setSonarQueryText(e.target.value)}
                  rows={4}
                  className="w-full p-4 rounded-xl bg-white border border-st text-tx font-matter text-sm focus:outline-none focus:ring-2 focus:ring-sr-indigo-300 transition-all resize-none"
                  placeholder="Acoustic return telemetry query..."
                />
              </div>

              {/* Pulse Controls & Acoustic Waveform Simulation */}
              <div className="flex items-center justify-between p-4 bg-sf-secondary/60 rounded-xl border border-st/60">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsSonarPlaying(!isSonarPlaying)}
                    className="w-11 h-11 rounded-full bg-sr-indigo-600 hover:bg-sr-indigo-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
                  >
                    {isSonarPlaying ? (
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Animated Acoustic Hydrophone Waveform */}
                  <div className="flex items-center gap-1 h-8">
                    {[14, 28, 20, 32, 16, 26, 36, 22, 18, 30, 34, 20, 14, 24, 30, 18, 26, 16, 22].map((h, idx) => (
                      <div
                        key={idx}
                        className={`w-1 rounded-full bg-cyan-600 transition-all duration-150 ${
                          isSonarPlaying ? 'animate-pulse' : 'opacity-35'
                        }`}
                        style={{ height: isSonarPlaying ? `${Math.max(6, (h * Math.sin((idx + 1) * 0.8)) % 32)}px` : `${h / 2}px` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-tx-tertiary">Inference Pipeline: <strong>Sagar-ATR:v3</strong></span>
                  <button 
                    onClick={onNavigateDashboard}
                    className="px-4 py-2 bg-white hover:bg-sf-secondary text-tx font-medium text-xs rounded-full border border-st shadow-xs cursor-pointer"
                  >
                    Inspect in Console
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HYDROGRAPHIC SPEECH COMMANDS */}
          {activeTab === 'voice-command' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col gap-4">
                <span className="text-xs uppercase font-semibold text-tx-tertiary tracking-wider">
                  Bridge & Hydrographer Speech Recognition
                </span>
                <h3 className="font-season-mix text-2xl text-tx font-medium">
                  Sagar-ASR: Nav-Dialect & Multilingual Voice Command
                </h3>
                <p className="text-sm text-tx-secondary font-matter leading-relaxed">
                  Trained on high-ambient-noise maritime vessels, naval communications, and multilingual Indian maritime dialects. Transcribes complex nautical coordinates and mission commands in real-time.
                </p>

                {/* Audio Sample Player */}
                <div className="p-4 rounded-xl bg-white border border-st/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsVoiceCmdPlaying(!isVoiceCmdPlaying)}
                      className="w-10 h-10 rounded-full bg-sr-indigo-600 text-white flex items-center justify-center cursor-pointer shadow-xs"
                    >
                      {isVoiceCmdPlaying ? (
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                      ) : (
                        <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                    <div>
                      <p className="text-xs font-medium text-tx">Naval_Bridge_Target_Confirm.wav</p>
                      <p className="text-[11px] text-tx-tertiary">Acoustic Noise Filtered • Hindi / Naval English</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-sr-indigo-600 bg-sr-indigo-50 px-2 py-1 rounded-md">
                    00:03 / 00:08
                  </span>
                </div>
              </div>

              {/* Live Transcription Box */}
              <div className="p-5 rounded-xl bg-white border border-st shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-tx-tertiary pb-2 border-b border-st/50">
                  <span className="font-medium">Command Interpretation</span>
                  <span className="text-emerald-600 font-medium">ATR Match: 99.4%</span>
                </div>
                <div className="font-matter text-sm text-tx leading-relaxed">
                  <span className="bg-sky-100 text-sky-950 px-1 rounded">"सागर कंट्रोल,"</span> सेक्टर ब्रावो में सोनार शैडो कंफर्म करो, और AUV को वेपॉइंट 03 पर 4 नॉट्स से मोड़ो।
                </div>
                <div className="pt-2 border-t border-st/50 flex items-center justify-between text-xs">
                  <span className="text-tx-tertiary font-mono">Action: AUTO_WAYPOINT_REDIRECT</span>
                  <span className="text-xs text-sr-indigo-600 font-medium">Lat: 18.532° N | Lon: 72.781° E</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WATERFALL VISION ATR */}
          {activeTab === 'waterfall-vision' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Waterfall Sonar Image with Bounding Boxes */}
              <div className="md:col-span-7 bg-white p-4 rounded-xl border border-st flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-st/60">
                  <span className="text-xs font-medium text-tx">Side-Scan Sonar Waterfall Scan #SURV-2026-08</span>
                  <button
                    type="button"
                    onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                    className="text-xs px-2.5 py-1 rounded-full bg-sf-secondary hover:bg-sf-tertiary text-tx-secondary font-matter transition-colors cursor-pointer"
                  >
                    {showBoundingBoxes ? 'Hide ATR Bounding Boxes' : 'Show ATR Bounding Boxes'}
                  </button>
                </div>

                <div className="relative bg-[#061325] rounded-lg p-6 border border-slate-700 min-h-[220px] flex flex-col justify-between text-slate-100 overflow-hidden">
                  {/* Subtle Sonar Grid Scan Lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,132,199,0.06)_1px,transparent_1px)] bg-[size:100%_8px] pointer-events-none" />

                  <div className="flex justify-between items-start relative z-10">
                    <div className={`p-2 rounded transition-all ${showBoundingBoxes ? 'border-2 border-cyan-400 bg-cyan-950/60 shadow-lg shadow-cyan-500/20' : ''}`}>
                      <p className="font-bold text-xs text-cyan-300">TARGET #01: LOST CARGO CONTAINER</p>
                      <p className="text-[11px] text-slate-300">Length: 12.2m • Shadow: 2.8m</p>
                    </div>
                    <div className={`p-1.5 rounded text-right transition-all ${showBoundingBoxes ? 'border-2 border-emerald-400 bg-emerald-950/60' : ''}`}>
                      <p className="text-[11px] font-semibold text-emerald-300">BATHYMETRY: 28.4m</p>
                      <p className="text-[10px] text-slate-400">Slant Range: 45m Port</p>
                    </div>
                  </div>

                  <div className={`my-4 p-2 rounded transition-all relative z-10 ${showBoundingBoxes ? 'border-2 border-amber-400 bg-amber-950/60' : ''}`}>
                    <div className="flex justify-between text-xs py-1 border-b border-slate-700/60">
                      <span className="text-amber-300 font-medium">TARGET #02: GHOST FISHING GEAR / NET CLUSTER</span>
                      <span className="text-slate-200">CONF: 98.4%</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 py-1">
                      <span>Area: ~64 sq.m • Hazard Severity: HIGH</span>
                      <span>Coordinates: 18.5328° N, 72.7816° E</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs relative z-10 pt-2 border-t border-slate-800 text-slate-400">
                    <span>Nadir Gap: Cleared</span>
                    <span className="text-cyan-400 font-mono">PORT / STARBOARD DUAL CHANNEL ACTIVE</span>
                  </div>
                </div>
              </div>

              {/* Extracted GeoJSON Telemetry */}
              <div className="md:col-span-5 bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-auto max-h-[320px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700 text-slate-400">
                    <span>Acoustic Target GeoJSON</span>
                    <span className="text-cyan-400 text-[10px]">REAL-TIME</span>
                  </div>
                  <pre className="text-cyan-300 leading-relaxed overflow-x-auto text-[11px]">
{`{
  "system": "SAGAR-ATR-ENTERPRISE",
  "target_id": "TGT-26057-04",
  "classification": "sunken_container",
  "confidence": 0.988,
  "coordinates": {
    "latitude": 18.5324,
    "longitude": 72.7812,
    "depth_m": 28.4
  },
  "hazard_risk": "critical_navigation",
  "status": "ground_truthed"
}`}
                  </pre>
                </div>
                <button
                  onClick={onNavigateDashboard}
                  className="mt-4 w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer"
                >
                  Verify Target in Mission Console
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
