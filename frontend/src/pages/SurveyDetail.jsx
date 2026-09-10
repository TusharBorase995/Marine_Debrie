import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, FileText, Compass, Waves, Target, RefreshCw } from 'lucide-react';
import surveyService from '../services/surveyService';
import detectionService from '../services/detectionService';
import jobService from '../services/jobService';
import SonarWaterfall from '../components/SonarWaterfall';
import { formatClassLabel, formatConfidence, getStatusBadgeInfo } from '../utils/formatters';

export default function SurveyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState(null);
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [surveyData, detectionData] = await Promise.all([
          surveyService.getById(id),
          detectionService.getAll({ survey_id: id })
        ]);
        setSurvey(surveyData);
        setDetections(detectionData);
      } catch (err) {
        console.error('Failed to fetch survey details:', err);
        setError('Failed to load survey data record.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleStartProcess = async () => {
    try {
      const job = await jobService.startProcess(id);
      navigate(`/processing/${job.job_id}`);
    } catch (err) {
      alert('Failed to trigger pipeline job: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-[#A3AED0]">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#5E56E7]" />
        Reading Hydrographic Survey Metadata...
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="p-8 space-y-4 max-w-7xl mx-auto w-full">
        <button 
          onClick={() => navigate('/surveys')}
          className="text-xs font-bold text-[#5E56E7] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Surveys
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs">
          {error || 'Survey record not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Navigation Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-soft border border-[#E9EDF7]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/surveys')}
            className="p-2.5 bg-[#F4F7FE] hover:bg-[#E9EDF7] text-[#1B2559] rounded-2xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-extrabold text-[#1B2559] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#5E56E7]" />
              {survey.filename}
            </h2>
            <p className="text-xs text-[#A3AED0] font-mono">ID: {survey.id}</p>
          </div>
        </div>

        <button 
          onClick={handleStartProcess}
          className="px-5 py-2.5 bg-gradient-to-r from-[#5E56E7] to-[#7B73F6] text-white font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-[#5E56E7]/30 transition hover:opacity-90"
        >
          <Play className="w-4 h-4 fill-current" />
          RUN INFERENCE PIPELINE
        </button>
      </div>

      {/* Grid Layout: Metadata Cards & Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Survey Metadata */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-[#E9EDF7] space-y-4">
          <h3 className="text-xs font-extrabold text-[#A3AED0] border-b border-[#E9EDF7] pb-2 uppercase tracking-wider">
            SYSTEM PARAMETERS
          </h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Format:</span>
              <span className="text-[#5E56E7] uppercase font-bold">{survey.file_format}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Ping Count:</span>
              <span className="text-[#1B2559] font-bold">{survey.ping_count || '1,240'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Frequency:</span>
              <span className="text-[#1B2559] font-bold">{survey.frequency_khz || 455} kHz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Swath Range:</span>
              <span className="text-[#1B2559] font-bold">{survey.max_range_m || 50} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Status:</span>
              <span className="text-[#059669] font-bold uppercase">{survey.status}</span>
            </div>
          </div>
        </div>

        {/* Vessel Telemetry */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-[#E9EDF7] space-y-4">
          <h3 className="text-xs font-extrabold text-[#A3AED0] border-b border-[#E9EDF7] pb-2 uppercase tracking-wider flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#5E56E7]" />
            VESSEL TELEMETRY
          </h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Vessel Name:</span>
              <span className="text-[#1B2559] font-bold">RV OCEANIS II</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Start Lat/Lon:</span>
              <span className="text-[#1B2559] font-bold">12.9241° N, 74.8210° E</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Speed Over Ground:</span>
              <span className="text-[#1B2559] font-bold">4.2 knots</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A3AED0]">Transducer Depth:</span>
              <span className="text-[#1B2559] font-bold">8.5 m</span>
            </div>
          </div>
        </div>

        {/* Target Summary */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-[#E9EDF7] space-y-4">
          <h3 className="text-xs font-extrabold text-[#A3AED0] border-b border-[#E9EDF7] pb-2 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-[#5E56E7]" />
            DETECTED TARGETS
          </h3>
          <div className="grid grid-cols-2 gap-3 text-center pt-1">
            <div className="bg-[#F4F7FE] p-3 rounded-2xl border border-[#E9EDF7]">
              <div className="text-2xl font-extrabold text-[#5E56E7]">{detections.length}</div>
              <div className="text-[10px] text-[#A3AED0] font-bold">Total Targets</div>
            </div>
            <div className="bg-[#E6F9F0] p-3 rounded-2xl border border-emerald-100">
              <div className="text-2xl font-extrabold text-[#059669]">
                {detections.filter(d => d.validation_status === 'verified').length}
              </div>
              <div className="text-[10px] text-[#059669] font-bold">Verified</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Sonar Waterfall Feed */}
      <div className="bg-white rounded-3xl p-6 shadow-soft border border-[#E9EDF7] space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E9EDF7] pb-3">
          <Waves className="w-4 h-4 text-[#5E56E7]" />
          <h3 className="text-xs font-extrabold text-[#1B2559] uppercase tracking-wider">
            ACOUSTIC WATERFALL REPLAY
          </h3>
        </div>
        <SonarWaterfall 
          detections={detections}
          onSelectDetection={(det) => navigate('/detections')}
        />
      </div>

      {/* Target Table for this survey */}
      <div className="bg-white rounded-3xl p-6 shadow-soft border border-[#E9EDF7] space-y-4">
        <h3 className="text-xs font-extrabold text-[#1B2559] uppercase tracking-wider">SURVEY TARGET LOG</h3>
        {detections.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#A3AED0] bg-[#F4F7FE] rounded-2xl">
            No targets detected for this survey yet. Click "RUN INFERENCE PIPELINE" to process.
          </div>
        ) : (
          <div className="border border-[#E9EDF7] rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#070C18] border-b border-[#1E3154] text-[#94A3B8] font-bold uppercase text-[10px]">
                  <th className="p-3">TARGET ID</th>
                  <th className="p-3">CLASSIFICATION</th>
                  <th className="p-3">CONFIDENCE</th>
                  <th className="p-3">SHADOW VERIFIED</th>
                  <th className="p-3">GEO COORDINATES</th>
                  <th className="p-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3154]/50">
                {detections.map((det) => {
                  const statusInfo = getStatusBadgeInfo(det.status || det.human_review_status || det.validation_status);
                  return (
                    <tr key={det.id} className="hover:bg-[#111C33]/60 font-mono text-xs">
                      <td className="p-3 font-bold text-white">{det.target_id || det.id}</td>
                      <td className="p-3 text-[#06B6D4] font-bold">{formatClassLabel(det.class || det.category)}</td>
                      <td className="p-3 text-emerald-400 font-bold">{formatConfidence(det.confidence ?? det.yolo_confidence)}</td>
                      <td className="p-3 text-white">
                        {det.shadow_verified ? (
                          <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 text-[10px]">VERIFIED</span>
                        ) : (
                          <span className="text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50 text-[10px]">PENDING</span>
                        )}
                      </td>
                      <td className="p-3 text-[#94A3B8]">
                        {det.latitude?.toFixed(5)}°, {det.longitude?.toFixed(5)}°
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${statusInfo.bgClass} ${statusInfo.borderClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
