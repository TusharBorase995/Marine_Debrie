import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import JobProgressTimeline from '../components/JobProgressTimeline';
import jobService from '../services/jobService';

export const ProcessingJobPage = () => {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let interval = null;

    const pollJob = async () => {
      try {
        const jobData = await jobService.getJobStatus(jobId);
        setJob(jobData);
        setLoading(false);

        if (jobData.status === 'completed' || jobData.status === 'failed') {
          if (interval) clearInterval(interval);
        }
      } catch (err) {
        console.error("Poll job error:", err);
      }
    };

    pollJob();
    interval = setInterval(pollJob, 1000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId]);

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="inline-flex items-center gap-1 font-extrabold text-xs text-[#5E56E7] hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </button>

      <div className="bg-white rounded-3xl p-8 border border-[#E9EDF7] shadow-soft space-y-6">
        <div className="flex items-center justify-between border-b border-[#E9EDF7] pb-4">
          <div>
            <span className="text-[10px] text-[#A3AED0] uppercase font-extrabold">Pipeline Job Execution</span>
            <h2 className="text-lg font-extrabold text-[#1B2559]">{jobId}</h2>
          </div>

          {job?.status === 'completed' && (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-gradient-to-r from-[#5E56E7] to-[#7B73F6] text-white font-extrabold text-xs rounded-2xl shadow-md shadow-[#5E56E7]/30 transition-all flex items-center gap-1 hover:opacity-90"
            >
              Inspect Dashboard <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#A3AED0]">
            Connecting to pipeline process manager...
          </div>
        ) : (
          <JobProgressTimeline 
            events={job?.events || []}
            currentStatus={job?.status || 'queued'}
            progress={job?.progress || 0}
          />
        )}
      </div>
    </div>
  );
};

export default ProcessingJobPage;
