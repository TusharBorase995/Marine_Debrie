import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

export const JobProgressTimeline = ({ events = [], currentStatus = "queued", progress = 0 }) => {
  const pipelineStages = [
    { key: 'queued', label: '1. Queued' },
    { key: 'parsing', label: '2. Sonar Parser' },
    { key: 'metadata_extraction', label: '3. Metadata' },
    { key: 'preprocessing', label: '4. Preprocess' },
    { key: 'ml_inference', label: '5. InferenceProvider' },
    { key: 'validation_georeferencing', label: '6. Georeference' },
    { key: 'completed', label: '7. Completed' }
  ];

  return (
    <div className="bg-white border border-[#E9EDF7] rounded-3xl p-6 font-sans text-xs text-[#1B2559] space-y-5 shadow-soft">
      <div className="flex items-center justify-between border-b border-[#E9EDF7] pb-3">
        <span className="font-extrabold text-[#5E56E7] uppercase tracking-wide">Processing Pipeline Stage Timeline</span>
        <span className="text-[#A3AED0] text-xs font-bold">PROGRESS: <strong className="text-[#5E56E7] font-mono">{progress}%</strong></span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#F4F7FE] h-2.5 rounded-full overflow-hidden border border-[#E9EDF7]">
        <div 
          className="bg-gradient-to-r from-[#5E56E7] to-[#7B73F6] h-full transition-all duration-300 rounded-full" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px] font-bold">
        {pipelineStages.map((st) => {
          const isDone = events.some(e => e.stage === st.key) || progress === 100;
          const isCurrent = currentStatus === st.key;

          return (
            <div 
              key={st.key}
              className={`p-2.5 rounded-2xl border transition-colors text-center ${
                isCurrent ? 'bg-[#5E56E7]/10 border-[#5E56E7] text-[#5E56E7] font-extrabold' :
                isDone ? 'bg-[#E6F9F0] border-emerald-200 text-[#059669]' : 'bg-[#F4F7FE] border-[#E9EDF7] text-[#A3AED0]'
              }`}
            >
              <div>{st.label}</div>
            </div>
          );
        })}
      </div>

      {/* Event Timeline Log */}
      <div className="space-y-3 pt-3 border-t border-[#E9EDF7] max-h-48 overflow-y-auto">
        <span className="text-[10px] text-[#A3AED0] uppercase font-extrabold block">Execution Event Logs</span>
        {events.map((ev, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-xs text-[#A3AED0] border-b border-[#E9EDF7]/60 pb-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-[#1B2559] font-extrabold font-mono">[{ev.stage.toUpperCase()}]</span> {ev.message}
              <span className="text-[10px] text-[#A3AED0] block font-mono mt-0.5">
                {new Date(ev.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobProgressTimeline;
