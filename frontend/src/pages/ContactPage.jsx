import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Send, 
  ShieldCheck, 
  Anchor, 
  Cpu, 
  Radio, 
  Building2, 
  Mail, 
  Phone, 
  User, 
  Compass
} from 'lucide-react';

export default function ContactPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    phoneCode: '+91',
    phone: '',
    organization: '',
    role: '',
    inquiryType: 'Fleet Deployment & Edge Inference',
    securityLevel: 'Standard Unclassified',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate high-tech encrypted transmission
    setTimeout(() => {
      setIsSubmitting(false);
      const ticketId = 'IN-SGR-' + Math.floor(1000 + Math.random() * 9000);
      setSubmittedTicket({
        id: ticketId,
        timestamp: new Date().toISOString(),
        email: formData.workEmail,
        org: formData.organization || 'Naval Operations Station'
      });
    }, 1100);
  };

  return (
    <div className="min-h-screen bg-sf text-tx font-matter flex flex-col lg:flex-row overflow-x-hidden selection:bg-cyan-500 selection:text-white">
      
      {/* 1. LEFT PANEL (Sarvam-Style Cinematic Brand & Channel Sidebar) */}
      <div className="w-full lg:w-[42%] lg:min-h-screen shrink-0 bg-[#0B192C] text-white relative flex flex-col justify-between p-8 sm:p-12 lg:p-14 overflow-hidden">
        
        {/* Subtle Ambient Glow Overlays */}
        <div 
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0284C7 0%, transparent 70%)' }}
        />
        <div 
          className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
        />

        {/* Top Header & Navigation */}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8 md:mb-12">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-xs md:text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Overview</span>
            </button>

            <span 
              onClick={() => navigate('/')}
              className="font-matter font-bold text-xl tracking-tight text-white lowercase cursor-pointer hover:opacity-85"
            >
              sagar
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-medium text-cyan-300 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>SOVEREIGN MARITIME INQUIRIES</span>
          </div>

          <h1 className="font-season-mix text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white leading-[1.12]">
            Connect with SAGAR Operations
          </h1>

          <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg font-normal">
            Tell us about your hydrographic fleet, side-scan sonar heads, or defense operational requirements. Our forward-deployed marine autonomy engineers will connect with you.
          </p>
        </div>

        {/* Middle Operational Channels (3 Cards Matching Sarvam Structure) */}
        <div className="relative z-10 my-8 sm:my-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-all">
            <Anchor className="w-5 h-5 text-cyan-400 mb-3" />
            <p className="text-xs font-semibold text-white">Fleet Deployments</p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">fleet@sagar.gov.in</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-all">
            <Cpu className="w-5 h-5 text-sky-400 mb-3" />
            <p className="text-xs font-semibold text-white">Air-Gap Defense</p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">defense@sagar.gov.in</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-all">
            <Radio className="w-5 h-5 text-indigo-400 mb-3" />
            <p className="text-xs font-semibold text-white">ATR Model Lab</p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">research@sagar.gov.in</p>
          </div>

        </div>

        {/* Bottom Station Coordinates */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex flex-col gap-1 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>National Hydrographic Maritime Command</span>
          </div>
          <p className="pl-6 text-[11px] text-slate-400">
            Mazagon Naval Complex, Mumbai 400010, Maharashtra, India
          </p>
        </div>

      </div>

      {/* 2. RIGHT PANEL (Clean, Seamless Sarvam-Style Form Area) */}
      <div className="flex-1 bg-sf px-6 sm:px-12 lg:px-16 py-10 lg:py-14 flex flex-col justify-center min-h-screen">
        <div className="w-full max-w-2xl mx-auto">
          
          {!submittedTicket ? (
            <div>
              <div className="mb-8">
                <h2 className="font-season-mix text-2xl sm:text-3xl font-medium text-tx tracking-tight">
                  Mission Consultation Request
                </h2>
                <p className="text-xs sm:text-sm text-tx-secondary mt-1 font-matter">
                  Please provide your operational details to initiate encrypted mission coordination.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                
                {/* Full Name Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="Commander Arjun"
                        className="w-full min-h-12 rounded-2xl border border-st bg-white px-4 py-3 text-sm text-tx outline-none transition-all placeholder:text-tx-tertiary focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Sharma"
                      className="w-full min-h-12 rounded-2xl border border-st bg-white px-4 py-3 text-sm text-tx outline-none transition-all placeholder:text-tx-tertiary focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                </div>

                {/* Email & Phone Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                      Official Work Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.workEmail}
                      onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                      placeholder="arjun.sharma@navy.gov.in"
                      className="w-full min-h-12 rounded-2xl border border-st bg-white px-4 py-3 text-sm text-tx outline-none transition-all placeholder:text-tx-tertiary focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                      Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                      <input
                        type="text"
                        value={formData.phoneCode}
                        onChange={(e) => setFormData({ ...formData, phoneCode: e.target.value })}
                        className="min-h-12 rounded-2xl border border-st bg-white px-3 py-3 text-sm text-tx text-center outline-none focus:border-cyan-700"
                      />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="98765 43210"
                        className="min-h-12 rounded-2xl border border-st bg-white px-4 py-3 text-sm text-tx outline-none transition-all placeholder:text-tx-tertiary focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15"
                      />
                    </div>
                  </div>
                </div>

                {/* Organization & Role Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                      Organization / Agency / Naval Station <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      placeholder="Indian Navy / National Hydrographic Office"
                      className="w-full min-h-12 rounded-2xl border border-st bg-white px-4 py-3 text-sm text-tx outline-none transition-all placeholder:text-tx-tertiary focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                      Role / Designation <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="Lead Marine Analyst / Survey Officer"
                      className="w-full min-h-12 rounded-2xl border border-st bg-white px-4 py-3 text-sm text-tx outline-none transition-all placeholder:text-tx-tertiary focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                </div>

                {/* Inquiry Type Select */}
                <div>
                  <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                    Primary Deployment Interest
                  </label>
                  <select
                    value={formData.inquiryType}
                    onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
                    className="w-full min-h-12 rounded-2xl border border-st bg-white px-4 py-3 text-sm text-tx outline-none transition-all focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15"
                  >
                    <option value="Fleet Deployment & Edge Inference">Vessel Edge Inference Runtime (AUVs & Towfishes)</option>
                    <option value="Naval Command Air-Gapped Deployment">Air-Gapped Sovereign Cluster (Classified Defense)</option>
                    <option value="Sagar Operational Cloud (Multi-Vessel)">Sagar Operational Telemetry Cloud (Multi-Ship Coordinated)</option>
                    <option value="Custom Sonar Head ATR Model Retraining">Custom Sonar Sensor ATR Pipeline Integration</option>
                    <option value="Hydrographic Survey Consultancy">Hydrographic Survey & Bathymetric Consultancy</option>
                  </select>
                </div>

                {/* Mission Scope & Message */}
                <div>
                  <label className="block text-xs font-medium text-tx-secondary mb-1.5">
                    Mission Scope & Requirements
                  </label>
                  <textarea
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Provide details regarding your survey area, side-scan sonar frequency (e.g. 100/400 kHz), target debris profiles, or operational timeline..."
                    className="w-full rounded-2xl border border-st bg-white p-4 text-sm text-tx outline-none transition-all placeholder:text-tx-tertiary focus:border-cyan-700 focus:ring-2 focus:ring-cyan-600/15 resize-y"
                  />
                </div>

                {/* Dual Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto flex-1 min-h-[44px] px-8 py-3 rounded-full text-white text-sm font-medium transition-all duration-200 active:scale-97 cursor-pointer flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)] disabled:opacity-50"
                    style={{ background: 'linear-gradient(to bottom, #3a3f5c 0%, #1e2033 100%)' }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Encrypting & Transmitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Mission Inquiry</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto px-6 py-3 rounded-full text-tx-secondary hover:text-tx text-sm font-medium border border-st/80 hover:bg-sf-secondary transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          ) : (
            /* Submission Success State */
            <div className="p-8 sm:p-12 rounded-3xl bg-white border border-st shadow-lg animate-arrival flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-xs font-mono font-semibold text-cyan-800 mb-3">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>TELEMETRY TRANSMISSION RECEIVED</span>
              </div>

              <h2 className="font-season-mix text-2xl sm:text-3xl font-medium text-tx">
                Inquiry Successfully Logged
              </h2>

              <p className="mt-3 text-sm text-tx-secondary max-w-md font-matter leading-relaxed">
                Your consultation request has been assigned priority routing. A designated hydrographic systems engineer will reach out to <strong className="text-tx">{submittedTicket.email}</strong> within 24 business hours.
              </p>

              {/* High-Tech Transmission Certificate Card */}
              <div className="w-full my-6 p-4 rounded-2xl bg-sf border border-st text-left font-mono text-xs text-tx-secondary space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-tx-tertiary">Mission Ticket ID:</span>
                  <span className="font-bold text-cyan-800">{submittedTicket.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tx-tertiary">Designation Organization:</span>
                  <span className="text-tx font-medium">{submittedTicket.org}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tx-tertiary">Sovereign Encryption:</span>
                  <span className="text-emerald-600 font-semibold">256-bit Air-Gapped SHA-2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tx-tertiary">Logged At:</span>
                  <span>{new Date(submittedTicket.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer shadow-sm transition-all"
                >
                  Return to Overview
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-2.5 rounded-full border border-st bg-sf-secondary hover:bg-white text-tx text-xs font-medium cursor-pointer transition-all"
                >
                  Explore Live Mission Platform
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
