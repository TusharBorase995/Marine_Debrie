import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BigSagarOceanVisual from '../components/sarvam/BigSagarOceanVisual';
import authService from '../services/authService';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  
  // Auth Modal State
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [userRole, setUserRole] = useState('Lead Marine Analyst');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Track scroll position for navbar styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fillTesterCredentials = () => {
    setAuthMode('login');
    setEmail('tester@sagar.gov.in');
    setPassword('Tester@123');
    setUserRole('Lead Marine Analyst');
    setAuthError('');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      let res;
      if (authMode === 'login') {
        res = await authService.login({
          email: email.trim(),
          password: password,
          role: userRole
        });
      } else {
        res = await authService.register({
          email: email.trim(),
          password: password,
          fullName: fullName.trim() || 'Marine Specialist',
          role: userRole
        });
      }

      if (res && res.user) {
        const u = res.user;
        localStorage.setItem('sonar_user_session', 'active');
        localStorage.setItem('sonar_user_id', u.user_id);
        localStorage.setItem('sonar_user_email', u.email);
        localStorage.setItem('sonar_user_name', u.full_name || 'Marine Specialist');
        localStorage.setItem('sonar_user_designation', userRole || u.role || 'Lead Marine Analyst');
        localStorage.setItem('sonar_user_station_id', u.is_demo ? 'IN-SAGAR-01' : `IN-${u.user_id.slice(-6)}`);
        navigate('/dashboard');
      } else {
        throw new Error('Authentication response was empty.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.response?.data?.detail || err.message || 'Authentication failed. Please check credentials.';
      setAuthError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sf text-tx font-matter selection:bg-cyan-500 selection:text-white overflow-x-hidden">
      
      {/* 1. TOP STICKY NAVBAR */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/90 backdrop-blur-md border-b border-st/80 py-3 shadow-xs' 
          : 'bg-transparent py-4 md:py-5'
      }`}>
        <div className="w-11/12 max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Clean Wordmark (Minimal lowercase sagar, no icon at top-left) */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center cursor-pointer select-none"
          >
            <span className="font-matter font-bold text-[22px] md:text-2xl tracking-tight text-[#1e2033] lowercase hover:opacity-80 transition-opacity">
              sagar
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-[15px] text-tx font-matter font-medium">
            <a href="#why-sagar" className="px-4 py-2 rounded-full hover:text-cyan-700 transition-colors cursor-pointer">
              Why Sovereign AI
            </a>
            <a href="#architecture" className="px-4 py-2 rounded-full hover:text-cyan-700 transition-colors cursor-pointer">
              Platform Architecture
            </a>
            <a href="#deployment" className="px-4 py-2 rounded-full hover:text-cyan-700 transition-colors cursor-pointer">
              Fleet & Defense
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-2.5">
            <button
              onClick={() => setShowSignInModal(true)}
              className="px-5 py-2 rounded-full text-white text-[15px] font-matter font-medium transition-all duration-200 active:scale-97 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)]"
              style={{ background: 'linear-gradient(to bottom, #3a3f5c 0%, #1e2033 100%)' }}
            >
              Log In
            </button>

            <button
              onClick={() => navigate('/contact')}
              className="px-5 py-2 rounded-full text-[#1e2033] bg-sf-secondary hover:bg-white border border-st/80 text-[15px] font-matter font-medium transition-all duration-200 active:scale-97 cursor-pointer shadow-[inset_0_0_0_1px_rgba(30,32,51,0.08)]"
            >
              Contact Us
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-tx hover:bg-sf-secondary"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-6 pt-4 pb-6 bg-white border-b border-st shadow-lg flex flex-col gap-3">
            <a href="#why-sagar" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium text-tx border-b border-st/40">Why Sovereign AI</a>
            <a href="#architecture" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium text-tx border-b border-st/40">Platform Architecture</a>
            <a href="#deployment" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium text-tx border-b border-st/40">Fleet & Defense Deployment</a>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => { setMobileMenuOpen(false); setShowSignInModal(true); }}
                className="w-full py-2.5 rounded-full text-white bg-slate-900 text-sm font-medium text-center shadow-sm"
              >
                Log In to Console
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/contact'); }}
                className="w-full py-2.5 rounded-full text-tx bg-sf-secondary text-sm font-medium text-center border border-st"
              >
                Contact Us
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION (SCREENSHOT 1) */}
      <section className="relative flex flex-col gap-8 md:gap-0 pt-28 md:pt-32 md:h-fit min-h-[92vh] overflow-x-clip">
        
        {/* Top Fade Gradient for clean navbar blending */}
        <div className="top-0 left-0 z-10 absolute bg-gradient-to-b from-white/90 via-white/25 to-transparent w-full h-24 pointer-events-none" aria-hidden="true" />

        {/* 
          EXACT SARVAM SAFFRON SUNSET HERO GRADIENT (Matches reference screenshot 100%)
          - Deep vibrant saffron orange (#F9730C) bowl at the top-center dipping right above the headline
          - Soft periwinkle / lavender (#A5BBFC) surrounding wings and sides
        */}
        <div 
          className="absolute inset-x-0 top-0 h-[620px] md:h-[680px] pointer-events-none z-0 overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse 1350px 530px at 50% -30px, #F9730C 0%, #F9730C 42%, #FF8515 52%, #FFB053 64%, #A5BBFC 78%, #Dbe6ff 88%, transparent 100%)',
          }}
        >
          {/* Exact Sarvam SVG Gradient Layer overlaid for signature feathered texture */}
          <img 
            src="/hero-gradient.svg" 
            alt="" 
            className="absolute left-1/2 max-w-none pointer-events-none select-none opacity-85"
            style={{
              width: '2800px',
              height: 'auto',
              top: '-640px',
              transform: 'translateX(-50%) scale(1.05, 0.88)',
              transformOrigin: 'top center',
            }}
            aria-hidden="true"
          />
        </div>

        <div className="z-10 relative flex flex-col md:flex-1 justify-center items-center mx-auto pb-[8vh] md:pb-[12vh] w-[90%] md:w-9/12 max-w-5xl">
          
          {/* Subtle Center Radial Blur Accent */}
          <div 
            className="top-[60%] left-1/2 -z-10 absolute opacity-35 md:opacity-45 blur-[80px] md:blur-[100px] w-72 md:w-[600px] h-72 md:h-[400px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" 
            style={{ background: 'radial-gradient(ellipse, #A5BBFC 0%, #D5E2FF 40%, transparent 70%)' }} 
            aria-hidden="true" 
          />

          {/* Center Project Logo: sagar_logo_transparent.png */}
          <div className="mb-2 md:mb-3 flex justify-center">
            <div className="relative group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 opacity-20 blur-lg group-hover:opacity-45 transition duration-500 pointer-events-none" />
              <img 
                src="/sagar_logo_transparent.png" 
                alt="SAGAR Logo" 
                className="relative w-20 h-20 md:w-24 md:h-24 object-contain filter drop-shadow-[0_8px_18px_rgba(2,132,199,0.22)] transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </div>

          {/* Tagline Badge with Radial Lines */}
          <div className="flex flex-col items-center gap-1.5 md:gap-2.5 mt-3 md:mt-5 w-fit">
            <div className="w-full h-px" style={{ background: 'radial-gradient(circle, #6a88e2 0%, transparent 100%)' }} aria-hidden="true" />
            <p className="px-8 font-matter text-sr-indigo-900 text-sm md:text-base text-center leading-normal tracking-wide font-medium">
              India's Sovereign Maritime AI Platform
            </p>
            <div className="w-full h-px" style={{ background: 'radial-gradient(circle, #6a88e2 0%, transparent 100%)' }} aria-hidden="true" />
          </div>

          {/* Main H1 Headline - Single Line */}
          <h1 className="mt-5 md:mt-7 w-full max-w-5xl font-season-mix text-3xl sm:text-4xl md:text-5xl lg:text-[54px] xl:text-[58px] text-tx text-center leading-[1.12] tracking-tight font-medium whitespace-normal md:whitespace-nowrap">
            Autonomous Ocean Intelligence from India
          </h1>

          {/* Subtitle - Both in Single Lines Each */}
          <div className="mt-4 md:mt-5 w-full max-w-4xl mx-auto flex flex-col items-center gap-1.5 font-matter text-tx-secondary text-sm sm:text-base md:text-[17px] text-center leading-relaxed">
            <p className="whitespace-normal sm:whitespace-nowrap">
              Built on sovereign hydrographic compute. Powered by frontier acoustic models.
            </p>
            <p className="whitespace-normal sm:whitespace-nowrap text-tx-tertiary">
              Delivering automated seabed debris detection, hazard localization, and bathymetric defense.
            </p>
          </div>

          {/* Dual Pill CTA Buttons - Only Login opens dashboard */}
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-5 mt-6 md:mt-8">
            <button
              onClick={() => setShowSignInModal(true)}
              className="group relative inline-flex items-center justify-center font-season-mix font-medium rounded-full min-h-[44px] text-white active:scale-[0.97] active:duration-150 transition-all duration-300 px-7 py-3 text-base cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)]"
              style={{ background: 'linear-gradient(to bottom, #3a3f5c 0%, #1e2033 100%)' }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>Log In to Console</span>
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </button>

            <button
              onClick={() => navigate('/contact')}
              className="group relative inline-flex items-center justify-center font-season-mix font-medium rounded-full min-h-[44px] text-[#1e2033] bg-white hover:bg-sf-secondary active:scale-[0.97] active:duration-150 transition-all duration-300 px-7 py-3 text-base cursor-pointer shadow-[inset_0_0_0_1px_rgba(30,32,51,0.14)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>Contact Us</span>
              </span>
            </button>
          </div>

        </div>
      </section>

      {/* 2. THE BIG "SAGAR" OCEAN VISUAL (PAGE 2) */}
      <BigSagarOceanVisual />

      {/* 3. "POWERING INDIA'S SOVEREIGN MARITIME FUTURE" (SCREENSHOT 2) */}
      <section id="why-sagar" className="py-24 md:py-32 bg-sf">
        <div className="w-11/12 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase text-cyan-700 tracking-wider">
              Why Sovereign Maritime AI
            </span>
            <h2 className="font-season-mix font-medium text-3xl md:text-5xl text-tx tracking-tight mt-2 mb-4">
              Powering India's sovereign maritime future
            </h2>
            <p className="font-matter text-tx-secondary text-base md:text-lg">
              Engineered from the seabed up to protect critical infrastructure, uncrewed survey assets, and shipping corridors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Sovereign by design',
                desc: 'All hydrographic survey data, acoustic signatures, and bathymetric maps stay strictly within Indian territory. Air-gapped defense compliance with zero foreign telemetry leakage.',
                icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
              },
              {
                title: 'Frontier acoustic models',
                desc: 'Trained on high-reverberation tropical waters, shallow coastal estuaries, sediment multipath, and complex seabed clutter encountered across Indian seas.',
                icon: 'M13 10V3L4 14h7v7l9-11h-7z'
              },
              {
                title: 'Forward deployed autonomy',
                desc: 'Forward-deployed naval software engineers working directly aboard hydrographic vessels and coastal command centers to integrate ATR pipelines with existing sonar heads.',
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
              }
            ].map((col, idx) => (
              <div key={idx} className="p-8 rounded-2xl bg-sf border border-st/80 flex flex-col justify-between hover:border-cyan-200 hover:shadow-md transition-all">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={col.icon} />
                    </svg>
                  </div>
                  <h3 className="font-matter font-semibold text-xl text-tx mb-3">
                    {col.title}
                  </h3>
                  <p className="font-matter text-sm text-tx-secondary leading-relaxed">
                    {col.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. "SAGAR FULL-STACK SOVEREIGN MARITIME PLATFORM" (SCREENSHOT 3) */}
      <section id="architecture" className="py-24 md:py-32 bg-sf">
        <div className="w-11/12 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-season-mix font-medium text-3xl md:text-5xl text-tx tracking-tight mb-4">
              Sagar Full-Stack Sovereign Maritime Platform
            </h2>
            <p className="font-matter text-tx-secondary text-base md:text-lg">
              A comprehensive three-tier system delivering end-to-end underwater autonomy.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {[
              {
                layer: 'LAYER 01',
                name: 'Mission-Scale Operational Console',
                desc: 'Real-time telemetry HUD, bathymetric GIS maps, target validation ground-truthing, and hydrographic survey packaging.',
                items: ['Hydrographic Survey Manager', 'Real-Time Target Ingestion', 'GIS Spatial Bathymetry', 'Analyst Ground-Truthing'],
                bgColor: 'bg-white',
                borderAccent: 'border-l-4 border-l-cyan-600'
              },
              {
                layer: 'LAYER 02',
                name: 'Frontier Hydrographic & Acoustic Models',
                desc: 'Models trained on millions of sonar ping returns delivering millimeter target discrimination and shadow validation.',
                items: ['Sagar-ATR:v3', 'ShadowSeg Neural Filter', 'Acoustic Reverberation Reducer', 'Mayura Hydrographic Translation'],
                bgColor: 'bg-white',
                borderAccent: 'border-l-4 border-l-orange-500'
              },
              {
                layer: 'LAYER 03',
                name: 'Infrastructure to Serve Fleet Telemetry Efficiently',
                desc: 'Edge inference fabric deployed directly on uncrewed surface vessels (USVs), AUV towfishes, and naval data centers.',
                items: ['Edge TPU AUV Runtime', 'Satellite & Acoustic Modem Stream', 'Low-SWaP Marine Compute', 'Air-Gapped Sovereign Cluster'],
                bgColor: 'bg-white',
                borderAccent: 'border-l-4 border-l-emerald-600'
              }
            ].map((tier, idx) => (
              <div key={idx} className={`p-8 rounded-2xl ${tier.bgColor} border border-st/80 ${tier.borderAccent} shadow-xs`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <span className="text-xs font-mono text-tx-tertiary uppercase tracking-wider">{tier.layer}</span>
                    <h3 className="font-matter font-semibold text-xl text-tx">{tier.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tier.items.map((item, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-sf-secondary text-tx-secondary text-xs font-medium border border-st/60">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="font-matter text-sm text-tx-secondary">{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. "BUILT TO RUN ANYWHERE YOUR FLEET OPERATES" (SCREENSHOT 4) */}
      <section id="deployment" className="py-24 md:py-32 bg-sf">
        <div className="w-11/12 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase text-cyan-700 tracking-wider">
              FLEET & DEFENSE READY
            </span>
            <h2 className="font-season-mix font-medium text-3xl md:text-5xl text-tx tracking-tight mt-2 mb-4">
              Built to run anywhere your fleet operates
            </h2>
            <p className="font-matter text-tx-secondary text-base md:text-lg">
              Deployment flexibility across survey vessels, uncrewed autonomous submersibles, and naval command centers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Sagar Operational Cloud',
                tag: 'Multi-Vessel Fleet',
                desc: 'Centrally aggregated hydrographic telemetry cloud for multi-ship coordinated survey missions and bathymetry.',
                features: ['Live mission telemetry aggregation', 'Multi-vessel synchronized survey lines', 'Automatic canonical CSV/JSON export', 'High-speed GIS tile server']
              },
              {
                title: 'Vessel Edge Deployment',
                tag: 'Low-SWaP Autonomous',
                desc: 'Containerized inference runtime designed for low-power onboard computing aboard AUVs and uncrewed vessels.',
                features: ['Real-time 15 FPS waterfall inference', 'Zero dependency on satellite links', 'Hardware acceleration (CUDA/TensorRT)', 'Local target shadow logging']
              },
              {
                title: 'Naval Command Air-Gap',
                tag: 'Total Sovereignty',
                desc: 'Classified on-premises deployment for port trusts, coast guard monitoring stations, and naval intelligence.',
                features: ['100% air-gapped without internet access', 'Role-based naval analyst access', 'Encrypted local database repository', 'SLA-backed defense support']
              }
            ].map((plan, idx) => (
              <div key={idx} className="p-8 rounded-2xl bg-sf border border-st flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-mono font-medium text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md">
                    {plan.tag}
                  </span>
                  <h3 className="font-matter font-semibold text-xl text-tx mt-4 mb-2">
                    {plan.title}
                  </h3>
                  <p className="font-matter text-xs text-tx-secondary leading-relaxed mb-6">
                    {plan.desc}
                  </p>
                  <ul className="space-y-2.5 text-xs text-tx font-matter">
                    {plan.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => navigate('/contact')}
                  className="mt-8 w-full py-2.5 rounded-full bg-white hover:bg-sf-secondary text-tx font-medium text-xs border border-st shadow-xs transition-all cursor-pointer"
                >
                  Configure Fleet Deployment
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. MINIMAL FOOTER */}
      <footer className="py-16 bg-sf">
        <div className="w-11/12 max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-st/30">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <span className="font-matter font-bold text-2xl tracking-tight text-[#1e2033] lowercase">
              sagar
            </span>
            <p className="text-xs text-tx-tertiary font-matter">
              India's Full-Stack Sovereign Maritime AI Platform.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/contact')}
              className="px-5 py-2.5 rounded-full text-tx text-xs font-matter font-medium border border-st/80 bg-white hover:bg-sf-secondary transition-all cursor-pointer"
            >
              Contact Operations
            </button>
            <button
              onClick={() => setShowSignInModal(true)}
              className="px-6 py-2.5 rounded-full text-white text-xs font-matter font-medium shadow-sm transition-all cursor-pointer bg-slate-900 hover:bg-slate-800"
            >
              Console Log In
            </button>
          </div>
        </div>

        <div className="w-11/12 max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-tx-tertiary">
          <p>© {new Date().getFullYear()} SAGAR. Sovereign Ocean & Acoustic AI Intelligence.</p>
          <div className="flex gap-6 mt-3 sm:mt-0">
            <span className="hover:text-tx cursor-pointer">Hydrographic Security Protocol</span>
            <span className="hover:text-tx cursor-pointer">Terms of Operation</span>
            <span className="hover:text-tx cursor-pointer">Air-Gap Verification</span>
          </div>
        </div>
      </footer>

      {/* AUTHENTICATION / PLATFORM LAUNCH MODAL */}
      {showSignInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-st max-w-lg w-full p-6 shadow-2xl animate-arrival relative my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-st/80">
              <div className="flex items-center gap-2.5">
                <span className="font-matter font-bold text-xl tracking-tight text-[#1e2033] lowercase">
                  sagar
                </span>
                <span className="text-[11px] bg-cyan-100/70 text-cyan-900 border border-cyan-300/60 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  Sovereign Cloud Console
                </span>
              </div>
              <button 
                onClick={() => { setShowSignInModal(false); setAuthError(''); }}
                className="text-tx-tertiary hover:text-tx text-lg w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Pre-Configured Tester Callout Box */}
            <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-cyan-50/90 via-sky-50/60 to-blue-50/80 border border-cyan-200/80 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-950">
                    <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
                    <span>Tester & Evaluator Fast Access</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-cyan-900/90 space-y-0.5">
                    <div><span className="text-cyan-700 font-semibold">Email:</span> tester@sagar.gov.in</div>
                    <div><span className="text-cyan-700 font-semibold">Password:</span> Tester@123</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fillTesterCredentials}
                  className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 active:scale-95 text-white text-[11px] font-semibold tracking-wide transition shadow-xs cursor-pointer shrink-0"
                >
                  ⚡ Auto-Fill Tester
                </button>
              </div>
              <p className="mt-2 text-[10px] text-cyan-800/80 leading-relaxed">
                Preloaded with live hydrographic survey data (<span className="font-mono font-semibold">MISSION-001</span>) stored in deployed Neon PostgreSQL.
              </p>
            </div>

            {/* Auth Mode Toggle Tabs */}
            <div className="flex mt-4 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer text-center ${
                  authMode === 'login'
                    ? 'bg-white text-[#1e2033] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Log In (Existing Account)
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer text-center ${
                  authMode === 'register'
                    ? 'bg-white text-[#1e2033] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create New Account
              </button>
            </div>

            {/* Error Banner */}
            {authError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium leading-tight">
                ⚠️ {authError}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="mt-4 flex flex-col gap-3.5">
              
              {/* Position / Role Selector */}
              <div>
                <label className="block text-xs font-bold text-[#1e2033] mb-1">
                  Operational Position / Designation
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium text-[#1e2033] bg-white focus:outline-none focus:ring-2 focus:ring-cyan-600/30 focus:border-cyan-600 transition"
                >
                  <option value="Lead Marine Analyst">Lead Marine Analyst (Acoustic Sonar Review)</option>
                  <option value="Autonomous Drone Operator">Autonomous Drone Operator (USV / UUV Fleet Control)</option>
                  <option value="Hydrographic Survey Specialist">Hydrographic Survey Specialist (Mission Bathymetry)</option>
                  <option value="Naval Operations Director">Naval Operations Director (Fleet Command & Strategy)</option>
                  <option value="ATR Deep Learning Specialist">ATR Deep Learning Specialist (Model Ground-Truthing)</option>
                </select>
              </div>

              {/* Full Name for Registration */}
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-[#1e2033] mb-1">
                    Full Name / Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Commander Vikram Singh"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium text-[#1e2033] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600/30 focus:border-cyan-600 transition"
                  />
                </div>
              )}

              {/* Email ID */}
              <div>
                <label className="block text-xs font-bold text-[#1e2033] mb-1">
                  Email Address / Station ID
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@organization.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium text-[#1e2033] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600/30 focus:border-cyan-600 transition font-mono"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-[#1e2033] mb-1">
                  Access Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium text-[#1e2033] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600/30 focus:border-cyan-600 transition font-mono"
                />
              </div>

              {/* Information Note */}
              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                {authMode === 'login' ? (
                  <span>
                    Logging in connects your session directly to the sovereign deployed database and immediately opens your active dashboard.
                  </span>
                ) : (
                  <span>
                    New accounts receive an isolated, independent workspace in Neon PostgreSQL with private S3 image storage. You can delete your account and all its data anytime.
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex-1 py-3 rounded-full text-white text-xs font-bold tracking-wide transition-all cursor-pointer shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(to bottom, #2b324b 0%, #151828 100%)' }}
                >
                  {authLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting Database...</span>
                    </>
                  ) : authMode === 'login' ? (
                    <span>Log In & Enter Dashboard →</span>
                  ) : (
                    <span>Create Independent Account & Launch →</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSignInModal(false); setAuthError(''); }}
                  className="px-5 py-3 rounded-full border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
