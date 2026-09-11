import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  FileText, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  MapPin, 
  Layers, 
  Activity, 
  Clock, 
  ArrowUpRight,
  Database,
  Loader2
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import exportService from '../services/exportService';

export const Reports = () => {
  const { 
    missions, 
    selectedMissionId, 
    setSelectedMissionId, 
    selectedMission,
    getMissionReport,
    reportsCache
  } = useMission();

  const [activeMission, setActiveMission] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState(null);

  // Sync activeMission with selectedMission from context
  useEffect(() => {
    if (selectedMission) {
      setActiveMission(selectedMission);
    } else if (missions.length > 0) {
      setActiveMission(missions[0]);
    }
  }, [selectedMission, missions]);

  // Load deterministic analysis with in-memory caching (0ms instant render)
  useEffect(() => {
    let isMounted = true;
    const fetchAnalysis = async () => {
      if (!activeMission) return;
      const cached = reportsCache[activeMission.mission_id];
      if (cached) {
        setAnalysis(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        setError(null);
        const data = await getMissionReport(activeMission.mission_id);
        if (isMounted) setAnalysis(data);
      } catch (err) {
        console.error('Failed to load mission analysis:', err);
        if (isMounted && !cached) setError('Unable to compile mission analysis dataset.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAnalysis();
    return () => { isMounted = false; };
  }, [activeMission, getMissionReport, reportsCache]);

  const handleDownloadPDF = async () => {
    if (!activeMission) return;
    try {
      setDownloadingPDF(true);
      await exportService.downloadPDF(activeMission.mission_id);
    } catch (err) {
      alert('Failed to generate PDF Report: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!activeMission) return;
    try {
      setDownloadingExcel(true);
      await exportService.downloadExcel(activeMission.mission_id);
    } catch (err) {
      alert('Failed to generate Excel Report: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDownloadingExcel(false);
    }
  };

  const kpis = analysis?.kpis || {
    total_targets: activeMission?.target_count || 0,
    high_confidence_count: 0,
    pending_count: activeMission?.pending_count || 0,
    shadow_verified_count: 0,
    shadow_verified_pct: 0,
    avg_confidence: 0,
    highest_density_sector: 'N/A'
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 font-sans bg-[#F8FAFC] min-h-screen text-slate-800">
      
      {/* 1. Header Action Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Mission Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Export hydrographic survey analytics and target data in PDF and Excel formats.
          </p>
        </div>

        {/* Action Export Buttons: PDF and Excel only */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF || !activeMission}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {downloadingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400" />
            )}
            <span>Download PDF Report</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            disabled={downloadingExcel || !activeMission}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {downloadingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            )}
            <span>Download Excel Report</span>
          </button>
        </div>
      </div>

      {/* 2. Survey Mission Selector Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            SELECT SURVEY MISSION FOR REPORT
          </h2>
          <span className="text-xs text-slate-400 font-mono">{missions.length} Registered Missions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {missions.length === 0 ? (
            <div className="col-span-3 bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400 font-mono">
              No survey missions currently registered in PostgreSQL. Detections streamed or uploaded will populate here automatically.
            </div>
          ) : (
            missions.map((m) => {
              const isSelected = activeMission?.mission_id === m.mission_id;
              const isLive = (m.ingestion_mode || '').toLowerCase() === 'live';
              const mDate = m.created_at 
                ? new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
                : 'Active';

              return (
                <div
                  key={m.mission_id}
                  onClick={() => {
                    setActiveMission(m);
                    setSelectedMissionId(m.mission_id);
                  }}
                  className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer relative shadow-2xs ${
                    isSelected 
                      ? 'border-2 border-blue-600 ring-2 ring-blue-100 shadow-md' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Compass className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold text-slate-400">{m.mission_id}</span>
                        <h3 className="text-xs font-black text-slate-900 line-clamp-1 leading-tight">{m.survey_name}</h3>
                      </div>
                    </div>

                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      isLive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {isLive ? 'LIVE' : 'BATCH'}
                    </span>
                  </div>

                  {/* Quick Metric Pills */}
                  <div className="grid grid-cols-4 gap-1 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center font-mono">
                    <div>
                      <span className="text-[8px] text-slate-400 font-bold uppercase block">TARGETS</span>
                      <span className="text-xs font-black text-slate-800">{m.target_count || m.detection_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-emerald-600 font-bold uppercase block">CONF</span>
                      <span className="text-xs font-black text-emerald-600">{m.confirmed_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-amber-600 font-bold uppercase block">PEND</span>
                      <span className="text-xs font-black text-amber-600">{m.pending_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-red-600 font-bold uppercase block">REJ</span>
                      <span className="text-xs font-black text-red-600">{m.rejected_count || 0}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 mt-3 flex items-center justify-between">
                    <span>{mDate}</span>
                    {isSelected && (
                      <span className="text-blue-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active Report
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Operational Report Preview */}
      {activeMission && (
        <div className="space-y-6">

          {/* Operational Assessment Card */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Mission Summary
              </h3>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-blue-700 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compiling mission statistics...
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-800 leading-relaxed">
                {analysis?.operational_assessment || 'No targets recorded for this mission.'}
              </p>
            )}
          </div>

          {/* 5 Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TOTAL TARGETS</span>
              <div className="text-2xl font-black font-mono text-slate-900">{kpis.total_targets}</div>
              <span className="text-[11px] text-slate-500">Acoustic Contacts</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">HIGH CONFIDENCE</span>
              <div className="text-2xl font-black font-mono text-emerald-600">{kpis.high_confidence_count}</div>
              <span className="text-[11px] text-slate-500">&ge; 80% Threshold</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">PENDING REVIEW</span>
              <div className="text-2xl font-black font-mono text-amber-600">{kpis.pending_count}</div>
              <span className="text-[11px] text-slate-500">Awaiting Action</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">SHADOW VERIFIED</span>
              <div className="text-2xl font-black font-mono text-blue-600">{kpis.shadow_verified_count}</div>
              <span className="text-[11px] text-slate-500">{kpis.shadow_verified_pct}% Verified</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TOP DENSITY AREA</span>
              <div className="text-lg font-black font-mono text-slate-800 line-clamp-1">{kpis.highest_density_sector}</div>
              <span className="text-[11px] text-slate-500">Peak Spatial Cluster</span>
            </div>
          </div>

          {/* Two-Column Deep-Dive: Classification & Survey Sectors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Target Classification Analysis */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Target Classification Analysis
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Mean Conf: <b>{kpis.avg_confidence}%</b>
                </span>
              </div>

              {(!analysis?.classification_analysis || analysis.classification_analysis.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-400 font-mono">
                  No classified targets in this mission.
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.classification_analysis.map((c) => (
                    <div key={c.class} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-800 font-bold">{c.label}</span>
                        <span className="font-mono text-slate-500">
                          {c.count} targets ({c.percentage}%) • avg {c.avg_confidence}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${c.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Target-Density Survey Sectors */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Survey Sector Geographic Ranking
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Spatial Concentration</span>
              </div>

              {(!analysis?.sector_analysis || analysis.sector_analysis.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-400 font-mono">
                  Insufficient coordinates to compute spatial sectors.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {analysis.sector_analysis.map((sec, idx) => (
                    <div key={sec.sector_id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{sec.sector_id}</div>
                          <div className="text-[10px] text-slate-400">Dominant: {sec.dominant_class}</div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-slate-800">{sec.target_count} targets ({sec.percentage}%)</div>
                        <div className="text-[10px] text-slate-400">Avg Conf: {sec.avg_confidence}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Review Priority Operator Targets Queue */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Priority Review Targets Queue
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Formula: (Conf &times; 40) + Pending(25) + Shadow(15) + Size(20)
              </span>
            </div>

            {(!analysis?.priority_targets || analysis.priority_targets.length === 0) ? (
              <div className="py-6 text-center text-xs text-slate-400 font-mono">
                No targets currently queued for inspection.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <th className="py-2 font-bold">Priority</th>
                      <th className="py-2 font-bold">Target ID</th>
                      <th className="py-2 font-bold">Classification</th>
                      <th className="py-2 font-bold">Confidence</th>
                      <th className="py-2 font-bold">Acoustic Shadow</th>
                      <th className="py-2 font-bold">Est. Size</th>
                      <th className="py-2 font-bold">Status</th>
                      <th className="py-2 font-bold text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {analysis.priority_targets.slice(0, 8).map((t) => (
                      <tr key={t.target_id} className="hover:bg-slate-50/50">
                        <td className="py-2 font-mono font-bold text-slate-400">#{t.rank}</td>
                        <td className="py-2 font-mono font-bold text-blue-600">{t.target_id}</td>
                        <td className="py-2 text-slate-800">{t.label}</td>
                        <td className="py-2 font-mono">{t.confidence}%</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            t.shadow_verified === 'Verified'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {t.shadow_verified}
                          </span>
                        </td>
                        <td className="py-2 font-mono">{t.estimated_size_m}m</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            t.status === 'confirmed' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : (t.status === 'pending_review' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 font-mono font-bold text-slate-900 text-right">
                          {t.priority_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Data Quality & Integrity Audit Summary */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <Database className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Data Quality & Analysis Integrity Audit
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">COORDINATE COVERAGE</span>
                <span className="text-sm font-black text-slate-800">
                  {analysis?.data_quality?.coordinate_completeness_pct || 0}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({analysis?.data_quality?.valid_coordinates || 0} / {kpis.total_targets} valid)
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">SHADOW VERIFICATION</span>
                <span className="text-sm font-black text-slate-800">
                  {kpis.shadow_verified_pct}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({kpis.shadow_verified_count} acoustic verified)
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">EVIDENCE IMAGERY</span>
                <span className="text-sm font-black text-slate-800">
                  {analysis?.data_quality?.evidence_completeness_pct || 0}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({analysis?.data_quality?.evidence_available || 0} associated crops)
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">ANALYST REVIEW STATUS</span>
                <span className="text-sm font-black text-slate-800">
                  {analysis?.review_status?.completion_pct || 0}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({analysis?.review_status?.reviewed_total || 0} reviewed)
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default Reports;
