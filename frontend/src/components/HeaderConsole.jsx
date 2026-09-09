import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Compass, Disc, MapPin, FileText, Settings, UploadCloud,
  Search, Bell, ChevronDown, LogOut, HelpCircle, Download, Trash2, AlertTriangle, ExternalLink,
  Target, X, CornerDownLeft, Sparkles, Layers, ShieldCheck, ArrowRight,
  PanelLeftClose, PanelLeftOpen, Database, CheckCircle2, RefreshCw
} from 'lucide-react';
import exportService from '../services/exportService';
import detectionService from '../services/detectionService';
import targetService from '../services/targetService';
import { useMission } from '../context/MissionContext';
import { formatClassLabel } from '../utils/formatters';

export const HeaderConsole = ({ wsConnected = false }) => {
  const navigate = useNavigate();

  // Sidebar resizable width state (persisted in localStorage)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sonar_sidebar_width');
    return saved ? Number(saved) : 260;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Consider collapsed if width is dragged below 130px
  const isCollapsed = sidebarWidth <= 130;

  const toggleCollapse = () => {
    if (isCollapsed) {
      const restored = Number(localStorage.getItem('sonar_last_expanded_width')) || 260;
      const target = Math.max(restored, 220);
      setSidebarWidth(target);
      localStorage.setItem('sonar_sidebar_width', target.toString());
    } else {
      localStorage.setItem('sonar_last_expanded_width', sidebarWidth.toString());
      setSidebarWidth(76);
      localStorage.setItem('sonar_sidebar_width', '76');
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDoubleClick = () => {
    setSidebarWidth(260);
    localStorage.setItem('sonar_sidebar_width', '260');
    localStorage.setItem('sonar_last_expanded_width', '260');
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const mouseX = e.clientX;
      if (mouseX < 140) {
        // Snap to compact icon-only rail
        setSidebarWidth(76);
      } else {
        const clamped = Math.min(Math.max(mouseX, 190), 380);
        setSidebarWidth(clamped);
        localStorage.setItem('sonar_last_expanded_width', clamped.toString());
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setSidebarWidth((curr) => {
          localStorage.setItem('sonar_sidebar_width', curr.toString());
          return curr;
        });
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const operationsNav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/surveys', label: 'Surveys', icon: Compass },
    { to: '/map', label: 'Map View', icon: MapPin },
    { to: '/upload', label: 'Ingestion Hub', icon: UploadCloud },
    { to: '/detections', label: 'Detections', icon: Disc },
    { to: '/reports', label: 'Reports', icon: FileText }
  ];

  const systemNav = [
    { to: '/settings', label: 'Settings', icon: Settings },
    { onClick: () => navigate('/settings'), label: 'Help & Docs', icon: HelpCircle },
    { to: '/', label: 'Public Portal', icon: ExternalLink, isPublic: true }
  ];

  const renderNavItem = (item) => {
    const Icon = item.icon;

    if (item.onClick) {
      return (
        <button
          key={item.label}
          onClick={item.onClick}
          title={isCollapsed ? item.label : undefined}
          className={`w-full relative flex items-center rounded-xl text-xs transition-all group cursor-pointer text-[#475569] hover:text-[#0B192C] hover:bg-[#F8FAFC] font-semibold ${
            isCollapsed 
              ? 'justify-center w-11 h-11 mx-auto my-0.5' 
              : 'gap-3 px-3.5 py-2.5 my-0.5'
          }`}
        >
          <Icon className={`shrink-0 transition-all duration-150 ${
            isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
          } text-[#64748B] group-hover:text-[#0B192C]`} />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0B192C] text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              {item.label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0B192C]" />
            </div>
          )}
        </button>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={isCollapsed ? item.label : undefined}
        className={({ isActive }) => `relative flex items-center rounded-xl text-xs transition-all group ${
          isCollapsed 
            ? 'justify-center w-11 h-11 mx-auto my-0.5' 
            : 'gap-3 px-3.5 py-2.5 my-0.5'
        } ${
          isActive 
            ? 'bg-[#EAF2FD] text-[#026AA7] font-bold shadow-2xs' 
            : 'text-[#475569] hover:text-[#0B192C] hover:bg-[#F8FAFC] font-semibold'
        } ${item.isPublic && !isCollapsed ? 'border-t border-slate-100 mt-2 pt-2.5' : ''}`}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <div className={`absolute left-0 top-2 bottom-2 bg-[#0284C7] rounded-r-full ${
                isCollapsed ? 'w-1' : 'w-1.5'
              }`} />
            )}
            <Icon className={`shrink-0 transition-all duration-150 ${
              isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
            } ${
              isActive ? 'text-[#026AA7]' : 'text-[#64748B] group-hover:text-[#0B192C]'
            }`} />
            {!isCollapsed && (
              <span className="truncate">{item.label}</span>
            )}
            {/* Tooltip on hover in collapsed mode */}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0B192C] text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0B192C]" />
              </div>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <aside 
      style={{ width: `${sidebarWidth}px` }}
      className={`bg-white border-r border-[#E5EDF5] flex flex-col justify-between select-none shrink-0 h-screen sticky top-0 z-30 overflow-y-auto relative ${
        isCollapsed ? 'p-2.5 items-center' : 'p-5'
      } ${isDragging ? 'transition-none' : 'transition-[width] duration-200 ease-out'}`}
    >
      {/* Brand & Logo + Collapse Toggle */}
      <div className="w-full">
        <div className={`flex items-center justify-between mb-6 transition-all ${
          isCollapsed ? 'justify-center' : 'px-1'
        }`}>
          <div 
            className={`flex items-center cursor-pointer group transition-all min-w-0 ${
              isCollapsed ? 'justify-center' : 'gap-3'
            }`} 
            onClick={() => navigate('/dashboard')}
            title="S.A.G.A.R Marine Intelligence"
          >
            <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-slate-200/80 hover:border-[#0284C7]/40 transition-all group-hover:scale-105 bg-white p-0">
              <img 
                src="/sagar_logo.png" 
                alt="S.A.G.A.R Logo" 
                className="w-full h-full object-cover scale-105" 
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 overflow-hidden">
                <h1 className="text-[15px] font-black text-[#0B192C] tracking-tight leading-none truncate">
                  S.A.G.A.R
                </h1>
                <p className="text-[9px] font-extrabold text-[#64748B] tracking-widest uppercase mt-1 truncate">
                  MARINE INTELLIGENCE
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              title="Collapse sidebar to icon rail"
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0B192C] hover:bg-[#F1F5F9] transition cursor-pointer shrink-0 ml-1"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* OPERATIONS Group */}
        {!isCollapsed ? (
          <div className="text-[10px] font-bold text-[#94A3B8] tracking-widest uppercase px-3.5 mb-2">
            OPERATIONS
          </div>
        ) : (
          <div className="w-8 h-px bg-slate-200 my-2 mx-auto" />
        )}

        {/* Navigation Links */}
        <nav className="space-y-0.5">
          {operationsNav.map(renderNavItem)}
        </nav>

        {/* SYSTEM Group */}
        {!isCollapsed ? (
          <div className="text-[10px] font-bold text-[#94A3B8] tracking-widest uppercase px-3.5 mt-5 mb-2">
            SYSTEM
          </div>
        ) : (
          <div className="w-8 h-px bg-slate-200 my-3 mx-auto" />
        )}

        <nav className="space-y-0.5">
          {systemNav.map(renderNavItem)}
        </nav>
      </div>

      {/* Sidebar Footer Cards */}
      {!isCollapsed ? (
        <div className="space-y-3 pt-4 mt-4 w-full">
          {/* Cleaner Oceans Submarine Image Card */}
          <div className="relative rounded-2xl overflow-hidden shadow-sm aspect-[16/10] flex flex-col justify-end p-3.5 border border-[#E5EDF5] group">
            <img 
              src="/images/underwater_sonar_towfish.jpg" 
              alt="Cleaner Oceans Towfish" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06182C] via-[#0B2545]/70 to-transparent" />
            <div className="relative z-10">
              <h4 className="text-[11px] font-black tracking-wider text-white uppercase leading-tight">
                CLEANER OCEANS
              </h4>
              <h4 className="text-[11px] font-black tracking-wider text-[#38BDF8] uppercase leading-tight">
                SAFER TOMORROWS
              </h4>
              <div className="w-6 h-0.5 bg-[#38BDF8] rounded-full mt-2" />
            </div>
          </div>

          {/* System Online Status Card */}
          <div className="bg-white p-3 rounded-xl border border-[#E5EDF5] shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#0B192C] leading-none">
                  System Online
                </div>
                <p className="text-[10px] text-[#64748B] mt-0.5">
                  Acoustic Engine v1.4
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pt-4 mt-auto space-y-2 flex flex-col items-center w-full">
          {/* Collapsed Towfish thumbnail with tooltip */}
          <div 
            onClick={toggleCollapse} 
            className="relative group cursor-pointer"
            title="Cleaner Oceans • Safer Tomorrows (Click to expand)"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#E5EDF5] shadow-2xs relative hover:scale-105 transition-transform">
              <img 
                src="/images/underwater_sonar_towfish.jpg" 
                alt="Towfish" 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-[#06182C]/30" />
            </div>
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0B192C] text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              <span>Cleaner Oceans • Safer Tomorrows</span>
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0B192C]" />
            </div>
          </div>

          {/* Collapsed System status dot with tooltip */}
          <div 
            className="relative group cursor-pointer"
            title="System Online — Acoustic Engine v1.4"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E5EDF5] shadow-2xs flex items-center justify-center hover:bg-slate-50 transition">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
            </div>
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0B192C] text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              <div className="text-xs font-bold text-white leading-tight">System Online</div>
              <div className="text-[10px] text-slate-300">Acoustic Engine v1.4</div>
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0B192C]" />
            </div>
          </div>

          {/* Expand Button in Collapsed Rail */}
          <button
            onClick={toggleCollapse}
            title="Expand sidebar"
            className="w-9 h-9 rounded-xl bg-[#F4F7FB] border border-[#E2E8F0] hover:bg-[#EAF2FD] text-[#64748B] hover:text-[#026AA7] flex items-center justify-center transition cursor-pointer mt-1"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Interactive Draggable Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={`absolute top-0 right-0 w-2 h-full cursor-col-resize z-40 transition-colors group ${
          isDragging 
            ? 'bg-[#0284C7]' 
            : 'hover:bg-[#0284C7]/40 bg-transparent'
        }`}
        title="Drag left/right to resize (drag left to collapse, double-click to reset)"
      >
        <div className={`absolute top-1/2 -translate-y-1/2 -right-0.5 w-1 h-10 rounded-full transition-all ${
          isDragging ? 'bg-[#0284C7]' : 'bg-slate-300 opacity-0 group-hover:opacity-100 group-hover:bg-[#0284C7]'
        }`} />
      </div>
    </aside>
  );
};

export const Topbar = ({ 
  title = "Operational Mission Dashboard", 
  subtitle = "Monitor, analyze, and manage your marine survey missions in real time." 
}) => {
  const navigate = useNavigate();
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [cachedTargets, setCachedTargets] = useState([]);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const { missions, setSelectedMissionId, dbStatus, checkDbHealth } = useMission();
  const [showDbModal, setShowDbModal] = useState(false);
  const [checkingDb, setCheckingDb] = useState(false);

  // Operational Profile & Session State (Designation based)
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileContainerRef = useRef(null);
  const [userDesignation, setUserDesignation] = useState(() => {
    return localStorage.getItem('sonar_user_designation') || 'Lead Marine Analyst';
  });
  const [stationId, setStationId] = useState(() => {
    return localStorage.getItem('sonar_user_station_id') || 'HYDRO-01';
  });

  // Calculate designation initials (e.g. "LM" for "Lead Marine Analyst")
  const designationInitials = useMemo(() => {
    const parts = (userDesignation || 'Lead Marine Analyst').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userDesignation.slice(0, 2).toUpperCase();
  }, [userDesignation]);

  // Click outside listener for profile dropdown
  useEffect(() => {
    const handleProfileClickOutside = (e) => {
      if (profileContainerRef.current && !profileContainerRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleProfileClickOutside);
    return () => document.removeEventListener('mousedown', handleProfileClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sonar_user_session');
    setIsProfileOpen(false);
    navigate('/');
  };

  // Load targets for global omnisearch
  useEffect(() => {
    targetService.getAll()
      .then(res => setCachedTargets(Array.isArray(res) ? res : []))
      .catch(err => console.warn("Could not load targets for search:", err));
  }, []);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close omnisearch dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = searchQuery.toLowerCase().trim();

  // 1. Matching Targets
  const matchingTargets = useMemo(() => {
    if (!q) return [];
    return cachedTargets.filter(t => {
      const tid = (t.target_id || t.id || '').toLowerCase();
      const rawCls = (t.class || t.category || '').toLowerCase();
      const formattedLabel = formatClassLabel(rawCls).toLowerCase();
      const label = (t.label || '').toLowerCase();
      const missionId = (t.mission_id || '').toLowerCase();
      const status = (t.status || t.human_review_status || '').toLowerCase();
      return (
        tid.includes(q) || 
        rawCls.includes(q) || 
        formattedLabel.includes(q) || 
        label.includes(q) || 
        missionId.includes(q) || 
        status.includes(q)
      );
    }).slice(0, 5);
  }, [cachedTargets, q]);

  // 2. Matching Missions
  const matchingMissions = useMemo(() => {
    if (!q) return [];
    return (missions || []).filter(m => {
      const mid = (m.mission_id || '').toLowerCase();
      const name = (m.survey_name || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      return mid.includes(q) || name.includes(q) || desc.includes(q);
    }).slice(0, 4);
  }, [missions, q]);

  // 3. Matching App Navigation Pages
  const matchingPages = useMemo(() => {
    if (!q) return [];
    const pages = [
      { name: 'Operational Dashboard', path: '/dashboard', hint: 'Mission metrics & telemetry' },
      { name: 'Surveys & Missions', path: '/surveys', hint: 'Manage surveys & data streams' },
      { name: 'Target Detections Audit', path: '/detections', hint: 'Inspect and ground-truth targets' },
      { name: 'Spatial GIS Map', path: '/map', hint: 'Bathymetric map & GIS markers' },
      { name: 'Mission Reports', path: '/reports', hint: 'Analytical summaries & data export' },
      { name: 'System Settings', path: '/settings', hint: 'Acoustic parameters & thresholds' }
    ];
    return pages.filter(p => p.name.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q)).slice(0, 3);
  }, [q]);

  const totalResultsCount = matchingTargets.length + matchingMissions.length + matchingPages.length;

  const handleSelectTarget = (target) => {
    const tid = target.target_id || target.id;
    navigate(`/detections?selected=${encodeURIComponent(tid)}&q=${encodeURIComponent(tid)}`);
    setIsSearchOpen(false);
  };

  const handleSelectMission = (mission) => {
    setSelectedMissionId(mission.mission_id);
    navigate(`/surveys?q=${encodeURIComponent(mission.mission_id)}`);
    setIsSearchOpen(false);
  };

  const handleSelectPage = (page) => {
    navigate(page.path);
    setIsSearchOpen(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!q) return;
    navigate(`/detections?q=${encodeURIComponent(q)}`);
    setIsSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const handleClearAll = async () => {
    try {
      setClearing(true);
      await detectionService.clearAll();
      setShowClearModal(false);
    } catch (err) {
      console.error("Failed to clear detections:", err);
      alert("Error clearing detections: " + (err.response?.data?.detail || err.message));
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between gap-4 py-3 px-8 bg-white border-b border-[#E5EDF5] sticky top-0 z-30">
        {/* Global Search Bar with Omnisearch Dropdown */}
        <div ref={searchContainerRef} className="flex-1 max-w-xl relative">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search missions, detections, or classifications..."
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              className="w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-full pl-10 pr-20 py-2 text-xs text-[#0B192C] placeholder-[#94A3B8] focus:outline-none focus:border-[#0284C7] focus:bg-white focus:ring-2 focus:ring-[#0284C7]/15 transition"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
              <span className="text-[10px] font-mono text-[#94A3B8] bg-white border border-[#E2E8F0] px-1.5 py-0.5 rounded shadow-2xs">
                Ctrl + K
              </span>
            </div>
          </form>

          {/* Omnisearch Interactive Dropdown */}
          {isSearchOpen && q && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden z-50 animate-arrival">
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {/* 1. Targets Section */}
                {matchingTargets.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                      <Target className="w-3 h-3 text-[#0284C7]" />
                      <span>Physical Targets ({matchingTargets.length})</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {matchingTargets.map((t) => {
                        const tid = t.target_id || t.id;
                        const conf = Math.round((t.fused_confidence ?? t.confidence ?? 0.85) * 100);
                        const isVerified = (t.status || t.human_review_status) === 'verified' || (t.status || t.human_review_status) === 'confirmed';
                        const isRejected = (t.status || t.human_review_status) === 'rejected';
                        return (
                          <div
                            key={tid}
                            onClick={() => handleSelectTarget(t)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F4F7FB] cursor-pointer transition group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0 font-mono text-[10px] font-bold">
                                {tid.slice(-3)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[#0B192C] group-hover:text-[#0284C7] transition truncate">
                                  {tid} — <span className="font-semibold">{formatClassLabel(t.class || t.category)}</span>
                                </div>
                                <div className="text-[10px] text-[#64748B] flex items-center gap-2">
                                  <span>Mission: {t.mission_id || 'MISSION-LIVE'}</span>
                                  <span>•</span>
                                  <span>{conf}% confidence</span>
                                </div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                              isVerified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              isRejected ? 'bg-red-50 text-red-700 border border-red-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {isVerified ? 'Verified' : isRejected ? 'Rejected' : 'Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Missions Section */}
                {matchingMissions.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                      <Compass className="w-3 h-3 text-[#0284C7]" />
                      <span>Survey Missions ({matchingMissions.length})</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {matchingMissions.map((m) => (
                        <div
                          key={m.mission_id}
                          onClick={() => handleSelectMission(m)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F4F7FB] cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-[#475569] flex items-center justify-center shrink-0">
                              <Compass className="w-3.5 h-3.5 text-[#0284C7]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#0B192C] group-hover:text-[#0284C7] transition truncate">
                                {m.mission_id} — {m.survey_name}
                              </div>
                              <div className="text-[10px] text-[#64748B] truncate">
                                {m.description || 'Bathymetric survey operation'}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                            m.ingestion_mode === 'live'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {m.ingestion_mode || 'BATCH'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Navigation Pages Section */}
                {matchingPages.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                      <Layers className="w-3 h-3 text-[#0284C7]" />
                      <span>Page Shortcuts</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {matchingPages.map((p) => (
                        <div
                          key={p.path}
                          onClick={() => handleSelectPage(p)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F4F7FB] cursor-pointer transition group"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#0B192C] group-hover:text-[#0284C7] transition">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              {p.hint}
                            </div>
                          </div>
                          <span className="text-[10px] text-[#0284C7] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Jump <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No results match */}
                {totalResultsCount === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-xs font-bold text-[#0B192C]">No instant matches for &ldquo;{searchQuery}&rdquo;</p>
                    <p className="text-[11px] text-[#64748B] mt-1">Press Enter to search the entire detections repository.</p>
                  </div>
                )}
              </div>

              {/* Footer action */}
              <div 
                onClick={handleSearchSubmit}
                className="bg-[#F8FAFC] px-4 py-2.5 border-t border-[#E2E8F0] flex items-center justify-between cursor-pointer hover:bg-[#F1F5F9] transition"
              >
                <div className="text-[11px] font-semibold text-[#475569] flex items-center gap-1.5">
                  <CornerDownLeft className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">Enter</kbd> to search detections for &ldquo;{searchQuery}&rdquo;</span>
                </div>
                <span className="text-xs font-bold text-[#0284C7] flex items-center gap-1">
                  View Results <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Actions, Notifications & Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* PostgreSQL Connection Status Badge */}
          <button
            onClick={() => setShowDbModal(true)}
            title={dbStatus?.connected ? "PostgreSQL database is online & active (Click for details)" : "PostgreSQL is offline! Click for instructions"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shadow-2xs cursor-pointer border ${
              dbStatus?.connected
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-red-50 hover:bg-red-100 text-red-700 border-red-300 animate-pulse"
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              dbStatus?.connected ? "bg-emerald-500 animate-pulse" : "bg-red-600"
            }`} />
            <Database className={`w-3.5 h-3.5 ${dbStatus?.connected ? "text-emerald-600" : "text-red-600"}`} />
            <span className="hidden md:inline">
              {dbStatus?.connected ? "PostgreSQL Active" : "PostgreSQL Offline"}
            </span>
          </button>

          {/* Clear / Purge All Detections Option */}
          <button
            onClick={() => setShowClearModal(true)}
            title="Remove all detected objects"
            className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full flex items-center gap-1 transition shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Data</span>
          </button>

          {/* Notification Bell */}
          <button 
            title="Notifications"
            className="w-9 h-9 rounded-full bg-[#F4F7FB] border border-[#E2E8F0] hover:bg-slate-100 flex items-center justify-center relative text-[#475569] transition shadow-2xs"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* Operational Designation Profile Pill with Logout Dropdown */}
          <div className="relative" ref={profileContainerRef}>
            <button
              onClick={() => setIsProfileOpen(prev => !prev)}
              aria-label="Operational Profile Menu"
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-full cursor-pointer transition shadow-2xs group focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#026AA7] to-[#38BDF8] text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                {designationInitials}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-[#0B192C] leading-none group-hover:text-[#026AA7] transition-colors">
                  {userDesignation}
                </div>
                <div className="text-[10px] text-[#64748B] mt-0.5 leading-none font-mono">
                  Station: {stationId}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-[#026AA7]' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-[#E5EDF5] py-2 z-50 animate-arrival">
                {/* Active Session Header */}
                <div className="px-4 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC] rounded-t-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0B3B60] to-[#0284C7] text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                      {designationInitials}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-[#0B192C] truncate">
                        {userDesignation}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-[#0284C7] font-semibold">
                          {stationId} &bull; Clearance L3
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-[#64748B] bg-white px-2 py-1 rounded-md border border-[#E2E8F0] flex items-center justify-between">
                    <span>ROLE: OPERATIONAL</span>
                    <span className="text-emerald-600 font-bold">AUTHENTICATED</span>
                  </div>
                </div>

                {/* Quick Navigation Links */}
                <div className="px-2 py-1.5 space-y-0.5 text-xs text-[#334155]">
                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/dashboard'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F1F5F9] transition text-left font-medium cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#64748B]" />
                    <span>Operational Dashboard</span>
                  </button>

                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/surveys'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F1F5F9] transition text-left font-medium cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-[#64748B]" />
                    <span>Surveys & Missions</span>
                  </button>

                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/map'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F1F5F9] transition text-left font-medium cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-[#64748B]" />
                    <span>GIS Spatial Map</span>
                  </button>

                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F1F5F9] transition text-left font-medium cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[#64748B]" />
                    <span>System Preferences</span>
                  </button>
                </div>

                {/* Divider & Operational Sign Out */}
                <div className="border-t border-[#F1F5F9] pt-1.5 px-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold transition text-xs text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Log Out (Terminate Session)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>


      {/* Confirmation Modal for Clearing Objects */}
      {showClearModal && (
        <div className="fixed inset-0 bg-[#0B192C]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5EDF5] space-y-4 animate-arrival">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0B192C]">Purge All Detected Objects</h3>
                <p className="text-xs text-[#64748B]">Permanently purge all targets and observations from PostgreSQL.</p>
              </div>
            </div>

            <p className="text-xs text-[#475569] bg-[#F4F7FB] p-3 rounded-xl border border-[#E2E8F0]">
              Purging all objects will permanently delete all active targets, GIS markers, and multi-pass sonar observations from your PostgreSQL database (<code>sonar_db</code>). This action cannot be undone.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-[#475569] hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearing ? "Purging..." : "Purge All Objects"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PostgreSQL Status & Recovery Modal */}
      {showDbModal && (
        <div className="fixed inset-0 bg-[#0B192C]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E5EDF5] space-y-4 animate-arrival">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                  dbStatus?.connected 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                    : "bg-red-50 text-red-600 border-red-100"
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0B192C]">
                    PostgreSQL Database Status
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Strict persistence engine for missions, targets, and sonar telemetry.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDbModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Status Card */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              dbStatus?.connected
                ? "bg-emerald-50/60 border-emerald-200"
                : "bg-red-50/70 border-red-200"
            }`}>
              {dbStatus?.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <div className={`font-bold ${dbStatus?.connected ? "text-emerald-900" : "text-red-900"}`}>
                  {dbStatus?.connected 
                    ? "PostgreSQL is Connected and Active" 
                    : "PostgreSQL Service is Offline or Unreachable"}
                </div>
                <p className={dbStatus?.connected ? "text-emerald-700" : "text-red-700"}>
                  {dbStatus?.connected
                    ? "All missions, sonar detections, and ground-truth reviews are committed directly to your PostgreSQL instance (sonar_db). No data will be lost upon restart."
                    : "The system enforces strict persistence. In-memory temporary fallbacks are completely disabled to prevent accidental data loss. Please start PostgreSQL to proceed."}
                </p>
                {dbStatus?.error && (
                  <p className="font-mono text-[11px] bg-red-100/70 text-red-800 p-2 rounded border border-red-200 break-all">
                    {dbStatus.error}
                  </p>
                )}
              </div>
            </div>

            {/* Recovery instructions if disconnected */}
            {!dbStatus?.connected && (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-[#0B192C] flex items-center gap-1.5">
                  <span>How to start PostgreSQL on Windows:</span>
                </div>
                <div className="space-y-1 text-[#475569]">
                  <p>1. Open PowerShell or Command Prompt as Administrator and run:</p>
                  <pre className="bg-[#0B192C] text-[#38BDF8] p-2 rounded text-[11px] font-mono overflow-x-auto select-all">
                    net start postgresql-x64-18
                  </pre>
                  <p className="mt-1">2. Or press <kbd className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">Win + R</kbd>, type <code className="text-slate-800 font-semibold">services.msc</code>, locate <strong>postgresql-x64-18</strong>, and click <strong>Start</strong>.</p>
                </div>
              </div>
            )}

            {/* Technical connection details */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Database</span>
                <span className="font-mono font-semibold text-[#0B192C]">sonar_db</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Host / Port</span>
                <span className="font-mono font-semibold text-[#0B192C]">localhost:5432</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={async () => {
                  setCheckingDb(true);
                  await checkDbHealth?.();
                  setCheckingDb(false);
                }}
                disabled={checkingDb}
                className="px-3 py-1.5 text-xs font-semibold text-[#026AA7] hover:bg-blue-50 border border-blue-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingDb ? "animate-spin" : ""}`} />
                <span>{checkingDb ? "Checking..." : "Re-check Connection"}</span>
              </button>
              <button
                onClick={() => setShowDbModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#0B192C] hover:bg-[#1E293B] rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HeaderConsole;
