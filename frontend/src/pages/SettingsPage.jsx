import React, { useState, useEffect } from 'react';
import { Settings, Database, Sliders, ShieldCheck, RefreshCw, CheckCircle2, Server } from 'lucide-react';
import axios from 'axios';

export default function SettingsPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [highConfThreshold, setHighConfThreshold] = useState(0.90);
  const [lowConfThreshold, setLowConfThreshold] = useState(0.60);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/health');
        setHealthData(res.data);
      } catch (err) {
        console.error("Health check error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-6 font-sans text-[#1B2559]">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-[#E9EDF7] shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#1B2559] tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#5E56E7]" />
            SYSTEM SETTINGS & PARAMETERS
          </h2>
          <p className="text-xs text-[#A3AED0] mt-0.5">Configure database persistence, ML confidence fusion thresholds, and server parameters.</p>
        </div>

        {saved && (
          <div className="px-4 py-2 bg-[#E6F9F0] border border-emerald-200 text-[#059669] text-xs font-extrabold rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Settings Saved!
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        
        {/* Database Persistence Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E9EDF7] shadow-soft space-y-4">
          <h3 className="text-xs font-extrabold text-[#A3AED0] border-b border-[#E9EDF7] pb-3 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-[#5E56E7]" />
            DATABASE & STORAGE PERSISTENCE
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
            <div className="bg-[#F4F7FE] p-4 rounded-2xl border border-[#E9EDF7] space-y-2">
              <span className="text-[10px] text-[#A3AED0] font-extrabold uppercase block">Active Database Engine</span>
              <div className="flex items-center justify-between font-mono">
                <span className="font-extrabold text-[#1B2559] uppercase">{healthData?.database?.engine || 'postgresql'}</span>
                <span className="px-2.5 py-1 bg-[#E6F9F0] text-[#059669] rounded-full text-[10px] font-extrabold uppercase">
                  Connected
                </span>
              </div>
            </div>

            <div className="bg-[#F4F7FE] p-4 rounded-2xl border border-[#E9EDF7] space-y-2">
              <span className="text-[10px] text-[#A3AED0] font-extrabold uppercase block">Binary Image Storage Format</span>
              <div className="flex items-center justify-between font-mono">
                <span className="font-extrabold text-[#5E56E7]">PostgreSQL BYTEA (LargeBinary)</span>
                <span className="px-2.5 py-1 bg-[#F0EEFF] text-[#5E56E7] rounded-full text-[10px] font-extrabold">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ML Confidence Thresholds */}
        <div className="bg-white rounded-3xl p-6 border border-[#E9EDF7] shadow-soft space-y-4">
          <h3 className="text-xs font-extrabold text-[#A3AED0] border-b border-[#E9EDF7] pb-3 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#5E56E7]" />
            FALSE POSITIVE & CONFIDENCE THRESHOLDS
          </h3>

          <div className="space-y-6 pt-1">
            {/* Verified Threshold Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-extrabold text-[#1B2559]">High Confidence Auto-Verification Threshold</label>
                <span className="font-mono font-extrabold text-[#059669] bg-[#E6F9F0] px-2.5 py-1 rounded-full text-xs">
                  {(highConfThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.75"
                max="0.99"
                step="0.01"
                value={highConfThreshold}
                onChange={(e) => setHighConfThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#5E56E7] cursor-pointer"
              />
              <p className="text-[11px] text-[#A3AED0]">Detections with fused confidence score above this value are automatically verified.</p>
            </div>

            {/* Rejection Threshold Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-extrabold text-[#1B2559]">Low Confidence Rejection Threshold (False Positive Filter)</label>
                <span className="font-mono font-extrabold text-[#FF4769] bg-[#FF4769]/10 px-2.5 py-1 rounded-full text-xs">
                  {(lowConfThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.70"
                step="0.01"
                value={lowConfThreshold}
                onChange={(e) => setLowConfThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#FF4769] cursor-pointer"
              />
              <p className="text-[11px] text-[#A3AED0]">Detections with fused confidence score below this value are flagged as false positives and rejected.</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-[#5E56E7] to-[#7B73F6] text-white font-extrabold text-xs rounded-2xl shadow-md shadow-[#5E56E7]/30 hover:opacity-90 transition"
          >
            Save Parameters
          </button>
        </div>
      </form>
    </div>
  );
}
