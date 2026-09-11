import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Compass, Plus, Search, FileText, CheckCircle2, 
  Trash2, UploadCloud, AlertCircle, Radio, Archive,
  MapPin, Clock, Filter, X, Database, RefreshCw
} from 'lucide-react';
import { useMission } from '../context/MissionContext';

export default function Surveys() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    missions, 
    selectedMissionId, 
    setSelectedMissionId, 
    loadingMissions, 
    refreshMissions,
    createMission, 
    deleteMission,
    error,
    dbStatus,
    checkDbHealth
  } = useMission();

  // Silent background revalidation on page mount
  useEffect(() => {
    refreshMissions();
  }, []);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Synchronize URL query parameter (e.g. from global Topbar search)
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null && qParam !== undefined) {
      setSearchTerm(qParam);
    }
  }, [searchParams]);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // New Mission Form State
  const [formData, setFormData] = useState({
    mission_id: '',
    survey_name: '',
    description: '',
    ingestion_mode: 'batch', // 'live' or 'batch'
    status: 'in_progress',
    date: new Date().toISOString().split('T')[0]
  });

  // Open modal with pre-generated mission ID
  const handleOpenCreateModal = () => {
    const nextNum = (missions.length + 1).toString().padStart(3, '0');
    setFormData({
      mission_id: `MISSION-${nextNum}`,
      survey_name: `Mission ${nextNum} — Offshore Survey`,
      description: 'High-resolution acoustic side-scan sonar hydrographic survey.',
      ingestion_mode: 'batch',
      status: 'in_progress',
      date: new Date().toISOString().split('T')[0]
    });
    setModalError('');
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.survey_name.trim()) {
      setModalError('Please enter a survey mission name.');
      return;
    }
    try {
      setSubmitting(true);
      setModalError('');
      const created = await createMission({
        mission_id: formData.mission_id.trim().toUpperCase(),
        survey_name: formData.survey_name.trim(),
        description: formData.description.trim(),
        ingestion_mode: formData.ingestion_mode,
        status: formData.status,
        created_at: new Date(formData.date).toISOString()
      });
      setIsCreateModalOpen(false);
      // Set as active mission immediately
      if (created?.mission_id) {
        setSelectedMissionId(created.mission_id);
      }
    } catch (err) {
      console.error('Failed to create mission:', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 503) {
        setModalError(detail || 'Database Offline: PostgreSQL is not reachable. Please start your PostgreSQL service (sonar_db) to save missions permanently.');
      } else {
        setModalError(detail || err.message || 'Failed to create mission');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (missionId, missionName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete mission "${missionName}" (${missionId}) and all its associated detections?`)) {
      return;
    }
    try {
      await deleteMission(missionId);
    } catch (err) {
      console.error('Failed to delete mission:', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 503) {
        alert(`Database Offline: Cannot delete mission while PostgreSQL is disconnected.\n\nDetail: ${detail || 'Please start your PostgreSQL service (sonar_db).'}`);
      } else {
        alert('Failed to delete mission: ' + (detail || err.message));
      }
    }
  };

  const filteredMissions = useMemo(() => {
    return missions.filter(m => {
      const matchSearch = 
        (m.mission_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.survey_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchMode = modeFilter === 'ALL' || (m.ingestion_mode || 'batch').toLowerCase() === modeFilter.toLowerCase();
      const matchStatus = statusFilter === 'ALL' || (m.status || 'completed').toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchMode && matchStatus;
    });
  }, [missions, searchTerm, modeFilter, statusFilter]);

  // Aggregate stats
  const totalMissions = missions.length;
  const liveCount = missions.filter(m => (m.ingestion_mode || '').toLowerCase() === 'live').length;
  const batchCount = missions.filter(m => (m.ingestion_mode || '').toLowerCase() === 'batch').length;
  const totalTargets = missions.reduce((sum, m) => sum + (m.target_count || m.detection_count || 0), 0);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full font-sans bg-[#F8FAFC] text-slate-800 min-h-screen">
      
      {/* PostgreSQL Offline Warning Banner */}
      {!dbStatus?.connected && (
        <div className="bg-red-50/95 border border-red-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs animate-arrival">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-950 flex items-center gap-2">
                <span>PostgreSQL Database Offline — Data Protection Mode</span>
                <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase">
                  Service Down
                </span>
              </h4>
              <p className="text-xs text-red-700 mt-1 max-w-2xl">
                The PostgreSQL database service (<strong>sonar_db</strong>) is not active. In-memory temporary fallbacks are disabled to prevent accidental data loss. Please start PostgreSQL to create or delete missions.
              </p>
              <div className="mt-2 text-xs font-mono bg-white/90 px-2.5 py-1 rounded-lg border border-red-200 text-slate-700 inline-block">
                net start postgresql-x64-18
              </div>
            </div>
          </div>
          <button
            onClick={() => checkDbHealth?.()}
            className="px-4 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Database</span>
          </button>
        </div>
      )}

      {/* 1. Header & Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Surveys & Missions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage acoustic survey missions and targets.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Create New Mission
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">REGISTERED MISSIONS</span>
          <div className="text-2xl font-black font-mono text-slate-900">{totalMissions}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Independent Survey Datasets</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Radio className="w-3 h-3" /> LIVE MODE MISSIONS
          </span>
          <div className="text-2xl font-black font-mono text-emerald-600">{liveCount}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Continuous ML Telemetry</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Archive className="w-3 h-3" /> BATCH MODE MISSIONS
          </span>
          <div className="text-2xl font-black font-mono text-indigo-600">{batchCount}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Completed Package Imports</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TOTAL TARGETS FOUND</span>
          <div className="text-2xl font-black font-mono text-slate-900">{totalTargets}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Acoustic Seafloor Contacts</span>
        </div>
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by mission ID, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 pl-9 pr-8 py-2 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0284C7] transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">MODE:</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Modes</option>
              <option value="LIVE">Live ML Stream</option>
              <option value="BATCH">Batch Package</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Missions List / Cards */}
      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      ) : (loadingMissions && missions.length === 0) ? (
        <div className="p-12 text-center text-slate-400 text-xs font-mono bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          Loading Survey Missions...
        </div>
      ) : filteredMissions.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 space-y-3">
          <Compass className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">No survey missions found matching filter criteria.</p>
          <button 
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create New Mission
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMissions.map((m) => {
            const mId = m.mission_id;
            const isActive = selectedMissionId === mId;
            const isLive = (m.ingestion_mode || '').toLowerCase() === 'live';
            const targetsCount = m.target_count || m.detection_count || 0;
            const confirmed = m.confirmed_count || 0;
            const pending = m.pending_count || 0;
            const rejected = m.rejected_count || 0;
            const reviewTotal = confirmed + pending + rejected;
            const progressPct = reviewTotal > 0 ? Math.round(((confirmed + rejected) / reviewTotal) * 100) : 0;
            const mDate = m.created_at 
              ? new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
              : 'Active';

            return (
              <div 
                key={mId}
                className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between shadow-xs relative ${
                  isActive 
                    ? 'border-2 border-indigo-600 ring-2 ring-indigo-100 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Active Mission Indicator Ribbon */}
                {isActive && (
                  <div className="absolute -top-3 right-5 bg-indigo-600 text-white text-[9px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs tracking-wider">
                    CURRENT ACTIVE MISSION
                  </div>
                )}

                <div>
                  {/* Top Bar: Mission ID & Ingestion Mode Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {mId}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border flex items-center gap-1 ${
                        isLive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {isLive ? (
                          <>
                            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                            LIVE STREAM
                          </>
                        ) : (
                          <>
                            <Archive className="w-3 h-3 text-indigo-600" />
                            BATCH IMPORT
                          </>
                        )}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        m.status === 'in_progress' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {m.status === 'in_progress' ? 'In Progress' : 'Completed'}
                      </span>
                    </div>
                  </div>

                  {/* Mission Title */}
                  <h3 className="text-base font-black text-slate-900 tracking-tight line-clamp-1 mt-1">
                    {m.survey_name}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {m.description || 'Acoustic side-scan sonar hydrographic survey.'}
                  </p>

                  <div className="text-[11px] text-slate-400 font-mono mt-2 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Registered: {mDate}</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 my-4 text-center">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">TARGETS</span>
                      <span className="font-mono font-black text-xs text-slate-900">{targetsCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase block">CONFIRMED</span>
                      <span className="font-mono font-black text-xs text-emerald-600">{confirmed}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-amber-600 uppercase block">PENDING</span>
                      <span className="font-mono font-black text-xs text-amber-600">{pending}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-red-600 uppercase block">REJECTED</span>
                      <span className="font-mono font-black text-xs text-red-600">{rejected}</span>
                    </div>
                  </div>

                  {/* Ground-Truthing Progress Bar */}
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                      <span>Ground-Truthing Review</span>
                      <span className="font-mono font-bold text-slate-700">{progressPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div style={{ width: `${progressPct}%` }} className="bg-indigo-600 h-full rounded-full transition-all" />
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    {!isActive ? (
                      <button
                        onClick={() => setSelectedMissionId(mId)}
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Select as Active
                      </button>
                    ) : (
                      <span className="flex-1 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> Active Mission
                      </span>
                    )}

                    <button
                      onClick={(e) => handleDelete(mId, m.survey_name, e)}
                      title="Delete Mission"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Workflow Navigation Quick Links */}
                  <div className="grid grid-cols-3 gap-1 text-[11px] font-bold">
                    <button
                      onClick={() => {
                        setSelectedMissionId(mId);
                        navigate('/map');
                      }}
                      className="py-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-center transition flex items-center justify-center gap-1"
                      title="Inspect Targets on Map"
                    >
                      <MapPin className="w-3 h-3 text-indigo-600" /> Map
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMissionId(mId);
                        navigate('/upload');
                      }}
                      className="py-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-center transition flex items-center justify-center gap-1"
                      title="Ingest ML Detections"
                    >
                      <UploadCloud className="w-3 h-3 text-emerald-600" /> Ingest
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMissionId(mId);
                        navigate('/reports');
                      }}
                      className="py-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-center transition flex items-center justify-center gap-1"
                      title="View Mission Report"
                    >
                      <FileText className="w-3 h-3 text-amber-600" /> Report
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* 5. CREATE NEW MISSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-arrival">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Compass className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Create New Survey Mission</h3>
                  <p className="text-xs text-slate-500">Configure mission metadata and select ingestion mode.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {!dbStatus?.connected && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-bold">PostgreSQL is Offline:</span> Missions cannot be created without active database persistence. Start your PostgreSQL service (<code>sonar_db</code>) to proceed.
                </div>
              </div>
            )}

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Error Registering Mission</div>
                  <p>{modalError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Mission ID & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    MISSION IDENTIFIER
                  </label>
                  <input
                    type="text"
                    value={formData.mission_id}
                    onChange={(e) => setFormData({ ...formData, mission_id: e.target.value })}
                    required
                    placeholder="e.g. MISSION-004"
                    className="w-full bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    SURVEY DATE
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Survey Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  MISSION / SURVEY NAME
                </label>
                <input
                  type="text"
                  value={formData.survey_name}
                  onChange={(e) => setFormData({ ...formData, survey_name: e.target.value })}
                  required
                  placeholder="e.g. Mission 004 — Harbor Anomaly Survey"
                  className="w-full bg-slate-50 border border-slate-200 font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  DESCRIPTION & OBJECTIVES
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the survey region, acoustic sensor, or target hazards..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* INGESTION MODE SELECTION: Live OR Batch (Strictly ONE) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center justify-between">
                  <span>ML INGESTION MODE (CHOOSE ONE)</span>
                  <span className="text-indigo-600 font-normal">Strictly mutually exclusive</span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Live Ingestion */}
                  <label 
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                      formData.ingestion_mode === 'live'
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Radio className={`w-4 h-4 ${formData.ingestion_mode === 'live' ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className="font-extrabold text-slate-900 text-xs">LIVE STREAM</span>
                      </div>
                      <input
                        type="radio"
                        name="ingestion_mode"
                        value="live"
                        checked={formData.ingestion_mode === 'live'}
                        onChange={() => setFormData({ ...formData, ingestion_mode: 'live' })}
                        className="accent-emerald-600"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      ML continuously streams detection JSON + image via WebSocket in real-time as inference occurs.
                    </p>
                  </label>

                  {/* Option 2: Batch Ingestion */}
                  <label 
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                      formData.ingestion_mode === 'batch'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Archive className={`w-4 h-4 ${formData.ingestion_mode === 'batch' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="font-extrabold text-slate-900 text-xs">BATCH IMPORT</span>
                      </div>
                      <input
                        type="radio"
                        name="ingestion_mode"
                        value="batch"
                        checked={formData.ingestion_mode === 'batch'}
                        onChange={() => setFormData({ ...formData, ingestion_mode: 'batch' })}
                        className="accent-indigo-600"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      ML provides completed package (detections.json + images/ or ZIP) uploaded at mission conclusion.
                    </p>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !dbStatus?.connected}
                  className={`px-5 py-2.5 font-bold rounded-xl transition shadow-sm flex items-center gap-2 ${
                    !dbStatus?.connected
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                  title={!dbStatus?.connected ? 'Cannot create missions while PostgreSQL is offline' : 'Register Mission'}
                >
                  {submitting 
                    ? 'Creating...' 
                    : !dbStatus?.connected 
                      ? 'PostgreSQL Disconnected' 
                      : 'Register Mission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
