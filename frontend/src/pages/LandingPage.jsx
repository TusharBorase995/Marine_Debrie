import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Waves, Compass, MapPin, Target, Shield, Radio, Database, 
  CheckCircle2, XCircle, ArrowRight, Layers, Activity, 
  Terminal, Crosshair, Anchor, Cpu, Scan, FileText, 
  Lock, ExternalLink, ChevronDown, RefreshCw
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // Interactive states
  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedTargetState, setSelectedTargetState] = useState('pending'); // 'pending', 'confirmed', 'rejected'
  const [scrolled, setScrolled] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [analystEmail, setAnalystEmail] = useState('HYDRO-01@naval.intel');
  const [analystRole, setAnalystRole] = useState('Lead Marine Analyst');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Live simulation ticker for telemetry HUD
  const [pingCount, setPingCount] = useState(14820);
  const [simLat, setSimLat] = useState(18.5324);
  const [simLon, setSimLon] = useState(72.7812);

  // Scroll listener for sticky header styling
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Periodic telemetry pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setPingCount(prev => prev + 12);
      setSimLat(prev => Number((prev + 0.00002).toFixed(5)));
      setSimLon(prev => Number((prev + 0.00001).toFixed(5)));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const handleEnterPlatform = () => {
    if (!localStorage.getItem('sonar_user_designation')) {
      localStorage.setItem('sonar_user_designation', 'Lead Marine Analyst');
      localStorage.setItem('sonar_user_station_id', 'HYDRO-01');
    }
    localStorage.setItem('sonar_user_session', 'active');
    navigate('/dashboard');
  };

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    setIsAuthenticating(true);

    let stId = 'HYDRO-01';
    if (analystRole.includes('Survey')) stId = 'SURV-02';
    else if (analystRole.includes('Naval')) stId = 'NAV-OPS-03';
    else if (analystRole.includes('ATR')) stId = 'ATR-RES-04';

    localStorage.setItem('sonar_user_designation', analystRole);
    localStorage.setItem('sonar_user_station_id', stId);
    localStorage.setItem('sonar_user_session', 'active');

    setTimeout(() => {
      setIsAuthenticating(false);
      setShowSignInModal(false);
      navigate('/dashboard');
    }, 500);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-[#030712] text-slate-100 min-h-screen font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      
      {/* 1. TOP MARITIME HUD NAVIGATION BAR */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-[#060e1a]/95 backdrop-blur-md border-b border-slate-800/80 shadow-2xl py-3' 
          : 'bg-gradient-to-b from-[#030712]/90 to-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          
          {/* Brand Logo & Naval Classification Badge */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-11 h-11 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-center overflow-hidden shadow-lg shadow-cyan-500/20 shrink-0 p-0.5">
              <img 
                src="/sagar_logo.png" 
                alt="S.A.G.A.R Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-widest text-white uppercase font-mono">S.A.G.A.R</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 uppercase">
                  PS 26057
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                NAVAL HYDROGRAPHIC INTEL
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-mono tracking-wider uppercase text-slate-300">
            <button onClick={() => scrollToSection('story')} className="hover:text-cyan-400 transition">
              SURVEILLANCE
            </button>
            <button onClick={() => scrollToSection('detection')} className="hover:text-cyan-400 transition">
              AI DETECTION
            </button>
            <button onClick={() => scrollToSection('georeferencing')} className="hover:text-cyan-400 transition">
              GEOREFERENCING
            </button>
            <button onClick={() => scrollToSection('human-loop')} className="hover:text-cyan-400 transition">
              ANALYST REVIEW
            </button>
            <button onClick={() => scrollToSection('capabilities')} className="hover:text-cyan-400 transition">
              CAPABILITIES
            </button>
          </nav>

          {/* Live Status & CTA Action Buttons */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">STATUS:</span>
              <span className="text-emerald-400 font-bold">OPERATIONAL</span>
            </div>

            <button
              onClick={() => setShowSignInModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/60 transition"
            >
              SIGN IN
            </button>

            <button
              onClick={handleEnterPlatform}
              className="px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 active:scale-95"
            >
              <span>ENTER PLATFORM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* 2. SECTION 1: HERO — “SEE WHAT LIES BENEATH” */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-6 overflow-hidden">
        
        {/* Cinematic Ocean Background Image with Depth Gradients */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero_naval_ocean.jpg" 
            alt="Naval hydrographic survey vessel at sea" 
            className="w-full h-full object-cover object-center scale-105 filter brightness-75 contrast-125"
          />
          {/* Deep Navy/Black Ocean Overlays (Strictly No Purple) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#060e1a]/85 to-[#060e1a]/40" />
          <div className="absolute inset-0 bg-radial-at-c from-transparent via-[#030712]/40 to-[#030712]" />
          
          {/* Subsea Tactical HUD Crosshair Grid Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e908_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e908_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        </div>

        {/* Ambient Animated Sonar Radar Sweeper in Background */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-cyan-500/15 pointer-events-none hidden xl:flex items-center justify-center opacity-70">
          <div className="w-[380px] h-[380px] rounded-full border border-cyan-500/10 flex items-center justify-center">
            <div className="w-[240px] h-[240px] rounded-full border border-cyan-500/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
          </div>
          {/* Rotating radar sweep ray */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-cyan-500/10 to-transparent animate-[spin_8s_linear_infinite]" />
          {/* Range markings */}
          <span className="absolute top-2 text-[9px] font-mono text-cyan-500/40">100m SWATH</span>
          <span className="absolute right-3 text-[9px] font-mono text-cyan-500/40">STARBOARD</span>
          <span className="absolute left-3 text-[9px] font-mono text-cyan-500/40">PORT</span>
        </div>

        {/* Hero Content Center Column */}
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-7">
          
          {/* Top Pill Classification */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-xs font-mono text-cyan-300 shadow-xl backdrop-blur-sm">
            <Scan className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="tracking-widest uppercase text-[11px] font-bold">ACOUSTIC TARGET RECOGNITION (ATR) PLATFORM</span>
            <span className="w-1 h-1 rounded-full bg-cyan-400" />
            <span className="text-slate-400 text-[10px]">HYDROGRAPHIC SPEC PS 26057</span>
          </div>

          {/* Main Hero Typography */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08] uppercase">
            AI-POWERED <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-blue-400">
              UNDERWATER ANOMALY
            </span> <br />
            DETECTION
          </h1>

          {/* Tagline & Purpose Statement */}
          <p className="text-lg sm:text-xl font-medium text-slate-200 max-w-2xl mx-auto leading-relaxed">
            “Turn side-scan sonar data into actionable, georeferenced intelligence.”
          </p>

          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Automated deep-learning detection and spatial georeferencing for submerged marine hazards — including ghost fishing debris nets, pipelines, submerged cylinders, and shipwreck structures.
          </p>

          {/* Primary Call-to-Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={handleEnterPlatform}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-black font-mono tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 transition shadow-xl shadow-cyan-500/30 flex items-center justify-center gap-2 active:scale-95 group"
            >
              <span>ENTER THE PLATFORM</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => scrollToSection('story')}
              className="w-full sm:w-auto px-7 py-4 rounded-xl text-sm font-bold font-mono tracking-wider text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition flex items-center justify-center gap-2"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>EXPLORE THE SYSTEM</span>
            </button>
          </div>

          {/* Real-Time Live Telemetry HUD Bar */}
          <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">SONAR FREQ</span>
              <span className="text-base font-black font-mono text-cyan-400">455 / 900 kHz</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">High-Res Chirp</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">SWATH COVERAGE</span>
              <span className="text-base font-black font-mono text-white">120 METERS</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Dual Port/Stbd</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">GEO POSITIONING</span>
              <span className="text-base font-black font-mono text-white">WGS-84 GIS</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">IHO S-44 Order 1a</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">REVIEW ARCHITECTURE</span>
              <span className="text-base font-black font-mono text-emerald-400">HUMAN-IN-LOOP</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Dual-Pass Verified</span>
            </div>
          </div>

        </div>

        {/* Scroll Down Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-400 cursor-pointer" onClick={() => scrollToSection('story')}>
          <span className="text-[10px] font-mono tracking-widest uppercase">SCROLL TO SUBMERGE</span>
          <ChevronDown className="w-4 h-4 animate-bounce text-cyan-400" />
        </div>

      </section>

      {/* 3. SECTION 2: SCROLL TRANSITION — “FROM OCEAN TO SIGNAL” */}
      <section id="story" className="relative py-28 px-6 bg-[#060e1a] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-16">
          
          {/* Header Banner */}
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-widest">
              <Anchor className="w-4 h-4" />
              <span>01 / SURVEY OPERATIONS</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              FROM OCEAN SURFACE TO ACOUSTIC SIGNAL
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Every hydrographic survey produces thousands of high-frequency acoustic observations across miles of seabed. Finding anomalies manually is slow, inconsistent, and cannot scale for critical maritime safety.
            </p>
          </div>

          {/* Visual Dual-Panel: Surface Survey Vessel vs Underwater Towfish Sensor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Image: Subsea Towfish Gliding Over Anomaly */}
            <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border border-slate-800 group shadow-2xl">
              <img 
                src="/images/underwater_sonar_towfish.jpg" 
                alt="AUV and side-scan sonar towfish underwater" 
                className="w-full h-[440px] object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060e1a] via-transparent to-transparent" />
              
              {/* Technical Telemetry Overlays */}
              <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 px-3 py-2 rounded-xl font-mono text-xs text-slate-300">
                <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>AUV TOWFISH TELEMETRY</span>
                </div>
                <p className="text-[11px] text-slate-400">ALTITUDE: 12.4m | DEPTH: 112.0m | SPEED: 3.2 kts</p>
                <p className="text-[10px] text-cyan-300/80">LAT: {simLat}° N | LON: {simLon}° E</p>
              </div>

              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-3 rounded-xl font-mono text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-slate-300">DUAL-BEAM SIDE-SCAN SWATH ACTIVE</span>
                </div>
                <span className="text-cyan-400 font-bold">PING #{pingCount}</span>
              </div>
            </div>

            {/* Right: Technical Explanation Cards */}
            <div className="lg:col-span-5 space-y-4">
              
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold uppercase">
                  <Layers className="w-4 h-4" />
                  <span>The Side-Scan Sonar Challenge</span>
                </div>
                <h3 className="text-lg font-bold text-white">Manual Review Fatigue & Spatial Error</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sonar operators inspect gigabytes of monochrome acoustic waterfall sweeps. Submerged hazards like snagged debris nets, partially buried pipelines, and unexploded ordnance appear as subtle textural reflections followed by acoustic shadow dropouts.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase">
                  <Cpu className="w-4 h-4" />
                  <span>The Machine Learning Solution</span>
                </div>
                <h3 className="text-lg font-bold text-white">Automated Candidate Extraction</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Our system ingests high-resolution side-scan waterfall imagery, executes automated object detection (YOLO/U-Net acoustic models), measures the acoustic shadow to estimate physical target height, and associates precise GPS coordinates.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-xs font-mono text-cyan-300 flex items-center gap-3">
                <Shield className="w-5 h-5 shrink-0 text-cyan-400" />
                <span>Standardized to IHO S-44 hydrographic standards with multi-pass track fusion.</span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 4. SECTION 3: AI DETECTION SECTION — “FIND THE ANOMALIES” */}
      <section id="detection" className="relative py-28 px-6 bg-[#030712] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-widest">
              <Scan className="w-4 h-4" />
              <span>02 / ACOUSTIC INFERENCE ENGINE</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              DEEP-LEARNING ANOMALY DETECTION
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Real-time ATR analyzes port and starboard acoustic intensity. As the sonar sweep advances, candidate objects are bounded, validated against acoustic shadows, and classified into canonical maritime hazard types.
            </p>
          </div>

          {/* Interactive Sonar Waterfall Screen with Technical AI Bounding Boxes */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black shadow-2xl">
            
            {/* Authentic Dual-Channel Sonar Waterfall Image */}
            <div className="relative w-full h-[520px]">
              <img 
                src="/images/sonar_waterfall_scan.jpg" 
                alt="Realistic side scan sonar waterfall image" 
                className="w-full h-full object-cover object-center"
              />

              {/* Scanning Laser Line (Restrained Cyan/Teal) */}
              <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-cyan-400/80 shadow-[0_0_12px_#22d3ee] pointer-events-none">
                <div className="absolute top-4 -left-12 bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 text-[10px] font-mono px-2 py-0.5 rounded uppercase">
                  SWEEP LINE
                </div>
              </div>

              {/* Bounding Box 1: Entangled Marine Debris Net */}
              <div className="absolute top-[18%] left-[26%] w-[120px] h-[100px] border-2 border-amber-400 bg-amber-400/10 rounded-lg p-1.5 font-mono pointer-events-auto transition hover:bg-amber-400/20 cursor-pointer">
                <div className="flex items-center justify-between text-[9px] font-bold text-amber-300 bg-slate-950/90 px-1 py-0.5 rounded">
                  <span>DEBRIS NET</span>
                  <span>94%</span>
                </div>
                <div className="mt-1 text-[8px] text-amber-200 bg-slate-950/80 px-1 py-0.5 rounded space-y-0.5">
                  <p>TGT-001</p>
                  <p>SIZE: 8.4m</p>
                  <p className="text-emerald-400 font-bold">SHADOW VERIFIED</p>
                </div>
              </div>

              {/* Bounding Box 2: Submerged Steel Pipeline */}
              <div className="absolute bottom-[22%] left-[16%] w-[180px] h-[70px] border-2 border-cyan-400 bg-cyan-400/10 rounded-lg p-1.5 font-mono pointer-events-auto transition hover:bg-cyan-400/20 cursor-pointer">
                <div className="flex items-center justify-between text-[9px] font-bold text-cyan-300 bg-slate-950/90 px-1 py-0.5 rounded">
                  <span>PIPE / CYLINDER</span>
                  <span>96%</span>
                </div>
                <div className="mt-1 text-[8px] text-cyan-200 bg-slate-950/80 px-1 py-0.5 rounded space-y-0.5">
                  <p>TGT-002</p>
                  <p>SIZE: 18.2m</p>
                  <p className="text-emerald-400 font-bold">SHADOW VERIFIED</p>
                </div>
              </div>

              {/* Bounding Box 3: Seabed Structural Anomaly on Starboard */}
              <div className="absolute top-[35%] right-[22%] w-[140px] h-[90px] border-2 border-sky-400 bg-sky-400/10 rounded-lg p-1.5 font-mono pointer-events-auto transition hover:bg-sky-400/20 cursor-pointer">
                <div className="flex items-center justify-between text-[9px] font-bold text-sky-300 bg-slate-950/90 px-1 py-0.5 rounded">
                  <span>WRECK STRUCTURE</span>
                  <span>91%</span>
                </div>
                <div className="mt-1 text-[8px] text-sky-200 bg-slate-950/80 px-1 py-0.5 rounded space-y-0.5">
                  <p>TGT-003</p>
                  <p>SIZE: 32.0m</p>
                  <p className="text-emerald-400 font-bold">MULTI-PASS</p>
                </div>
              </div>

              {/* Top HUD Bar */}
              <div className="absolute top-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5" /> ATR LIVE INFERENCE
                  </span>
                  <span className="text-slate-400 text-[11px] hidden sm:inline">SWATH: 120m | FREQ: 455 kHz</span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-slate-300">CONFIDENCE: <strong className="text-emerald-400">&ge; 90%</strong></span>
                  <span className="text-slate-300">ACOUSTIC SHADOW: <strong className="text-cyan-400">CORRELATED</strong></span>
                </div>
              </div>

            </div>

            {/* Bottom Analysis Metrics Row */}
            <div className="p-6 bg-slate-950 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase">Target 01: Ghost Gear Net</span>
                <p className="text-sm font-bold text-amber-400">DEBRIS NET (TGT-001)</p>
                <p className="text-xs text-slate-400">Irregular acoustic texture with large trailing acoustic shadow. Threat to maritime propulsion and subsea infrastructure.</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase">Target 02: Subsea Pipeline</span>
                <p className="text-sm font-bold text-cyan-400">PIPE / CYLINDER (TGT-002)</p>
                <p className="text-xs text-slate-400">Linear continuous high-reflectivity acoustic signature with continuous shadow boundary. Free-span monitoring enabled.</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase">Target 03: Sunken Vessel</span>
                <p className="text-sm font-bold text-sky-400">WRECK STRUCTURE (TGT-003)</p>
                <p className="text-xs text-slate-400">High-relief metallic structural obstacle. Verified across multiple survey passes with fused confidence score of 91%.</p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. SECTION 4: GEOREFERENCING SECTION — “FROM PIXELS TO POSITION” */}
      <section id="georeferencing" className="relative py-28 px-6 bg-[#060e1a] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-widest">
              <MapPin className="w-4 h-4" />
              <span>03 / SPATIAL GEOREFERENCING</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              FROM RAW PIXELS TO GEOGRAPHIC POSITION
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              A pixel on a waterfall scan is useless without spatial georeferencing. The system computes towfish layback, cable catenary, heading, and slant-range correction to map every sonar contact into precise WGS-84 coordinates.
            </p>
          </div>

          {/* GIS Nautical Chart Simulation Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left: Map Visualization Terminal */}
            <div className="lg:col-span-8 bg-[#091322] rounded-2xl border border-slate-700/80 p-5 shadow-2xl space-y-4">
              
              {/* GIS Map Controls Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold">BATHYMETRIC GIS NAUTICAL CHART</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded text-slate-400">DATUM: WGS-84</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span>SCALE: 1:2500</span>
                  <span className="text-cyan-400 font-bold">1 TARGET = 1 PIN</span>
                </div>
              </div>

              {/* Map Chart Area with Tracklines and Target Pins */}
              <div className="relative h-[380px] rounded-xl bg-[#07101d] border border-slate-800/80 overflow-hidden">
                
                {/* Nautical Depth Contour Lines (Stylized SVG Grid) */}
                <svg className="absolute inset-0 w-full h-full stroke-slate-800/40 fill-none">
                  <path d="M0,100 Q300,80 600,120 T1200,90" strokeWidth="1" strokeDasharray="4 4" />
                  <path d="M0,180 Q350,150 700,200 T1200,160" strokeWidth="1" strokeDasharray="4 4" />
                  <path d="M0,260 Q280,240 650,280 T1200,240" strokeWidth="1" strokeDasharray="4 4" />
                  <path d="M0,340 Q320,310 750,350 T1200,320" strokeWidth="1" strokeDasharray="4 4" />
                </svg>

                {/* Sonar Swath Coverage Polygon */}
                <div className="absolute top-[70px] left-[60px] right-[80px] h-[160px] bg-cyan-500/5 border-y border-cyan-500/20 transform -rotate-3 pointer-events-none" />

                {/* Vessel Survey Trackline */}
                <div className="absolute top-[145px] left-0 right-0 h-[2px] bg-blue-500/60 border-b border-dashed border-cyan-400/80 transform -rotate-3">
                  <div className="absolute right-[140px] -top-3 flex items-center gap-1.5 bg-slate-900 border border-cyan-500/40 px-2 py-0.5 rounded text-[9px] font-mono text-cyan-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>AUV SURVEY TRACK</span>
                  </div>
                </div>

                {/* Target Marker Pin: TGT-023 */}
                <div className="absolute top-[170px] left-[42%] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer">
                  {/* Pin Pulse Glow */}
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                  </div>

                  {/* Target Callout Box */}
                  <div className="mt-2 bg-slate-950/95 border border-amber-500/60 p-3 rounded-xl shadow-2xl font-mono text-left w-52 space-y-1 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">TGT-023</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                        94% CONF
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-white">DEBRIS NET</p>
                    <div className="text-[10px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                      <p>LAT: 18.53241° N</p>
                      <p>LON: 72.78123° E</p>
                      <p>SIZE: 8.4 m | DEPTH: 112m</p>
                    </div>
                  </div>
                </div>

                {/* Target Marker Pin: TGT-041 (Pipeline Joint) */}
                <div className="absolute bottom-[40px] left-[72%] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  </div>
                  <div className="mt-1 bg-slate-950/90 border border-cyan-500/40 px-2 py-1 rounded text-[9px] font-mono text-cyan-300">
                    TGT-041 (PIPE / 96%)
                  </div>
                </div>

              </div>

              {/* Map Footer Telemetry */}
              <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 pt-1">
                <span>CENTER: 18.5324° N, 72.7812° E</span>
                <span>TARGET REPOSITORIES CONSOLIDATED: 1 PHYSICAL CONTACT = 1 MARKER</span>
              </div>

            </div>

            {/* Right: Technical Explanation */}
            <div className="lg:col-span-4 space-y-4">
              
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold uppercase">
                  <Crosshair className="w-4 h-4" />
                  <span>Physical Target Consolidation</span>
                </div>
                <h3 className="text-xl font-bold text-white">No Duplicate Marker Clutter</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  When a vessel runs multiple overlapping survey passes, the same physical pipeline or debris hazard is detected repeatedly from different azimuth angles.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Our system spatial clustering algorithm automatically fuses multi-pass observations into a single confirmed physical contact with unified fused confidence.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>HORIZONTAL SLANT CORRECTION:</span>
                  <span className="text-cyan-400 font-bold">ACTIVE</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>AUV CABLE LAYBACK FUSION:</span>
                  <span className="text-cyan-400 font-bold">SYNCHRONIZED</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>EXPORT COMPLIANCE:</span>
                  <span className="text-emerald-400 font-bold">GEOJSON / CSV / SHP</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 6. SECTION 5: HUMAN-IN-THE-LOOP SECTION — “AI DETECTS. ANALYST DECIDES.” */}
      <section id="human-loop" className="relative py-28 px-6 bg-[#030712] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest">
              <Shield className="w-4 h-4" />
              <span>04 / HUMAN-IN-THE-LOOP VERIFICATION</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              AI DETECTS. ANALYST DECIDES.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Maritime security and subsea pipeline clearance cannot rely on black-box predictions alone. The platform empowers hydrographic specialists with high-speed ground-truthing and verification controls.
            </p>
          </div>

          {/* Interactive Analyst Workstation Card */}
          <div className="max-w-4xl mx-auto bg-slate-900/90 rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded">
                    ANALYST INSPECTION PANEL
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">SURVEY PASS: 2 OF 2</span>
                </div>
                <h3 className="text-2xl font-mono font-black text-white">TARGET TGT-023</h3>
                <p className="text-xs text-slate-400">Submerged Ghost Fishing Gear & Synthetic Netting Anomaly</p>
              </div>

              {/* Dynamic Status Badge */}
              <div>
                {selectedTargetState === 'pending' && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    PENDING ANALYST ACTION
                  </span>
                )}
                {selectedTargetState === 'confirmed' && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    CONFIRMED PHYSICAL HAZARD
                  </span>
                )}
                {selectedTargetState === 'rejected' && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-400" />
                    REJECTED (FALSE POSITIVE FILTERED)
                  </span>
                )}
              </div>
            </div>

            {/* Middle Grid: Evidence Snapshot + Telemetry Data */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Evidence Snapshot (5 cols) */}
              <div className="md:col-span-5 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase">ACOUSTIC EVIDENCE SNAPSHOT</span>
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-square flex items-center justify-center">
                  <img 
                    src="/images/sonar_waterfall_scan.jpg" 
                    alt="Target evidence crop" 
                    className="w-full h-full object-cover scale-150 filter contrast-125"
                  />
                  <div className="absolute inset-0 border border-amber-400/40 pointer-events-none" />
                  <div className="absolute bottom-2 left-2 bg-slate-950/90 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/40">
                    CROP: 120 kHz CHIRP
                  </div>
                </div>
              </div>

              {/* Acoustic Parameters (7 cols) */}
              <div className="md:col-span-7 space-y-3 font-mono text-xs">
                <span className="text-[10px] font-mono text-slate-400 uppercase">PHYSICAL ACOUSTIC PARAMETERS</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">MODEL CONFIDENCE</span>
                    <span className="text-xl font-black text-cyan-400">94.2%</span>
                  </div>
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">ESTIMATED EXTENT</span>
                    <span className="text-xl font-black text-white">8.4 METERS</span>
                  </div>
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">ACOUSTIC SHADOW</span>
                    <span className="text-xl font-black text-emerald-400">VERIFIED</span>
                  </div>
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">SEABED DEPTH</span>
                    <span className="text-xl font-black text-white">112.4 METERS</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block">COORDINATES (WGS-84)</span>
                  <p className="text-xs font-bold text-slate-200">18.53241° N, 72.78123° E</p>
                  <p className="text-[10px] text-slate-500">TIMESTAMP: 05 SEP 2026 12:30:00 UTC</p>
                </div>
              </div>

            </div>

            {/* Action Buttons for Ground-Truthing */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-400 font-mono">
                Click to test human-in-the-loop validation response:
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedTargetState('confirmed')}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 ${
                    selectedTargetState === 'confirmed'
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFIRM TARGET</span>
                </button>

                <button
                  onClick={() => setSelectedTargetState('rejected')}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 ${
                    selectedTargetState === 'rejected'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>REJECT / FALSE POSITIVE</span>
                </button>

                {selectedTargetState !== 'pending' && (
                  <button 
                    onClick={() => setSelectedTargetState('pending')} 
                    className="p-2 text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-800 transition"
                    title="Reset simulation"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. SECTION 6: COMMAND CENTER SECTION — “ONE OPERATIONAL VIEW” */}
      <section id="command" className="relative py-28 px-6 bg-[#060e1a] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-widest">
              <Terminal className="w-4 h-4" />
              <span>05 / COMMAND CONSOLE</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              ONE INTEGRATED OPERATIONAL PICTURE
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              No fragmented spreadsheets or disconnected imagery folders. The platform unifies live acoustic feeds, interactive GIS maps, target inspection cards, and exportable hydrographic reports into one mission dashboard.
            </p>
          </div>

          {/* Large Command Console Visual Container */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-700/90 shadow-2xl group">
            
            {/* Command Ops Background */}
            <div className="relative h-[480px]">
              <img 
                src="/images/naval_command_ops.jpg" 
                alt="Naval hydrographic operations command center" 
                className="w-full h-full object-cover filter brightness-85 contrast-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060e1a] via-[#060e1a]/40 to-transparent" />
            </div>

            {/* Floating Live Telemetry Sync Overlay Card */}
            <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-[#030712]/95 backdrop-blur-md border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 font-bold">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>WEBSOCKET REAL-TIME SYNC BRIDGE ACTIVE</span>
                </div>
                <h4 className="text-lg font-bold text-white">Live Operations Terminal Ready</h4>
                <p className="text-xs text-slate-400 max-w-xl">
                  Connect ML systems directly via Mode A (Live multipart HTTP stream) or Mode B (Mission batch dataset imports) to visualize detections immediately.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleEnterPlatform}
                  className="px-6 py-3 rounded-xl text-xs font-black font-mono tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/30 flex items-center gap-2 active:scale-95"
                >
                  <span>LAUNCH DASHBOARD</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 8. SECTION 7: CAPABILITIES SECTION */}
      <section id="capabilities" className="relative py-28 px-6 bg-[#030712] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-widest">
              <Cpu className="w-4 h-4" />
              <span>06 / CORE CAPABILITIES</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              TECHNICAL SPECIFICATIONS & ARCHITECTURE
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Engineered specifically to solve Problem Statement 26057. Designed for scalable deployment across hydrographic survey vessels, naval command centers, and subsea inspection teams.
            </p>
          </div>

          {/* Compact Technical Capability Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Scan className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono uppercase">SIDE-SCAN SONAR ANALYSIS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automated detection of marine debris, submerged ghost nets, seabed pipelines, cylinders, and structural wreck hazards in high-frequency acoustic waterfall scans.
              </p>
              <div className="text-[10px] font-mono text-cyan-400 font-semibold pt-1">
                &bull; Dual-channel 455/900 kHz support
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono uppercase">AI CONFIDENCE & VALIDATION</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Surfaces continuous neural network confidence metrics and correlates positive acoustic reflections with corresponding physical acoustic shadow lengths.
              </p>
              <div className="text-[10px] font-mono text-cyan-400 font-semibold pt-1">
                &bull; Shadow-verified contact filtering
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono uppercase">SPATIAL GEOREFERENCING</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Transforms sensor-relative slant-range pixels into precise WGS-84 geographic coordinates, eliminating multi-pass clutter with target clustering.
              </p>
              <div className="text-[10px] font-mono text-cyan-400 font-semibold pt-1">
                &bull; 1 Physical Target = 1 GIS Marker
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono uppercase">MODE A: LIVE INGESTION</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                High-speed multipart HTTP API accepting real-time JSON detection output and binary sonar evidence images from external ML pipelines with WebSocket broadcast.
              </p>
              <div className="text-[10px] font-mono text-cyan-400 font-semibold pt-1">
                &bull; Zero-delay real-time dashboard updates
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono uppercase">MODE B: BATCH INGESTION</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Import complete post-mission survey datasets via canonical JSON batches or packaged ZIP archives containing sonar imagery and acoustic coordinates.
              </p>
              <div className="text-[10px] font-mono text-cyan-400 font-semibold pt-1">
                &bull; Multi-survey independent mission management
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono uppercase">HYDROGRAPHIC REPORTING</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate mission intelligence summaries and export verified contacts in standard JSON and CSV formats for marine navigation and clearing operations.
              </p>
              <div className="text-[10px] font-mono text-cyan-400 font-semibold pt-1">
                &bull; Canonical field exports & analyst records
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 9. SECTION 8: FINAL CTA — “READY TO SEE WHAT'S BELOW?” */}
      <section className="relative py-32 px-6 bg-[#060e1a] border-t border-slate-800/80 text-center overflow-hidden">
        
        {/* Subtle Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-cyan-500/30 text-xs font-mono text-cyan-400">
            <Anchor className="w-3.5 h-3.5" />
            <span>OPERATIONAL MARITIME PLATFORM READY</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase leading-tight">
            READY TO SEE WHAT’S BELOW?
          </h2>

          <p className="text-lg text-slate-300 font-mono leading-relaxed">
            “From raw sonar imagery to georeferenced marine intelligence.”
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={handleEnterPlatform}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-black font-mono tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 transition shadow-xl shadow-cyan-500/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <span>ENTER PLATFORM</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowSignInModal(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-bold font-mono tracking-wider text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>SIGN IN AS ANALYST</span>
            </button>
          </div>

        </div>

        {/* Global Footer */}
        <footer className="mt-28 pt-8 border-t border-slate-800/80 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-4">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold">SONAR AI</span>
            <span>&mdash; Automated Side-Scan Sonar Anomaly Detection (PS 26057)</span>
          </div>
          <div className="flex items-center gap-6 text-[11px]">
            <span>IHO S-44 ORDER 1A COMPLIANT</span>
            <span>WGS-84 BATHYMETRIC DATUM</span>
            <span>v1.4 PRODUCTION</span>
          </div>
        </footer>

      </section>

      {/* 10. AUTHENTICATION / SIGN IN MODAL */}
      {showSignInModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1320] border border-slate-700 rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-mono font-bold text-white">OPERATIONAL SIGN IN</h3>
                  <p className="text-xs text-slate-400">Hydrographic Terminal Authentication</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSignInModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSignInSubmit} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 block font-bold">OPERATIONAL IDENTIFIER / CREDENTIAL</label>
                <input
                  type="text"
                  value={analystEmail}
                  onChange={(e) => setAnalystEmail(e.target.value)}
                  placeholder="HYDRO-01@naval.intel"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-400 font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 block font-bold">OPERATIONAL DESIGNATION</label>
                <select
                  value={analystRole}
                  onChange={(e) => setAnalystRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-400"
                >
                  <option value="Lead Marine Analyst">Lead Marine Analyst (Station: HYDRO-01)</option>
                  <option value="Hydrographic Survey Officer">Hydrographic Survey Officer (Station: SURV-02)</option>
                  <option value="Naval Operations Officer">Naval Operations Officer (Station: NAV-OPS-03)</option>
                  <option value="Acoustic ATR Researcher">Acoustic ATR Researcher (Station: ATR-RES-04)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-300">
                &bull; Authorized terminal session will establish a live WebSocket link to the mission feed and redirect directly to the Operational Dashboard.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignInModal(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-6 py-2.5 rounded-xl font-bold text-black bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>AUTHENTICATING...</span>
                    </>
                  ) : (
                    <>
                      <span>AUTHENTICATE & ENTER</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
