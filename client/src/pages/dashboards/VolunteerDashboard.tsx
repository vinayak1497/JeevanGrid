import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const VolunteerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    async function loadVolunteerData() {
      try {
        const res = await apiFetch('/dashboards/volunteer');
        setData(res);
        setTasks(res.assignedTasks || []);
      } catch (err) {
        console.error('Failed to load volunteer data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadVolunteerData();
  }, []);

  const handleCompleteTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'COMPLETED' } : t))
    );
  };

  if (loading) {
    return <div className="pt-28 pb-20 text-center text-xs text-on-surface-variant">Loading Community Volunteer Hub...</div>;
  }

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      <section className="bg-surface-container-low py-space-lg border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              Aapda Mitra &amp; Civil Defence Network
            </span>
            <h1 className="font-headline-xl text-2xl font-bold text-on-surface">
              Community Volunteer Ground Station
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Volunteer: <strong>{user?.name || 'Pooja Kulkarni'}</strong> • Sector: Mumbai Suburban Ward H/W
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-lg flex flex-col gap-space-lg">
        {/* Volunteer Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Tasks Completed</span>
            <p className="font-display-lg text-2xl font-bold text-primary mt-1">
              {tasks.filter((t) => t.status === 'COMPLETED').length + (data?.totalCompleted || 10)}
            </p>
          </div>
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Civic Hours Contributed</span>
            <p className="font-display-lg text-2xl font-bold text-secondary mt-1">{data?.hoursContributed || 38} hrs</p>
          </div>
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Emergency Readiness</span>
            <p className="font-display-lg text-2xl font-bold text-surface-tint mt-1">Level 2 Certified</p>
          </div>
        </div>

        {/* Task List */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm">
          <h2 className="font-headline-sm text-base font-bold text-on-surface mb-space-md">
            Assigned Community Resilience Missions
          </h2>

          <div className="flex flex-col gap-space-sm">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-xs text-on-surface">{task.title}</span>
                    <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                      task.status === 'COMPLETED' ? 'bg-[#e9f3ed] text-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{task.instructions}</p>
                  <span className="text-[11px] text-secondary font-semibold mt-1 block">📍 {task.location}</span>
                </div>

                {task.status !== 'COMPLETED' ? (
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all self-start sm:self-auto shrink-0 shadow-xs"
                  >
                    Mark Verified &amp; Done
                  </button>
                ) : (
                  <span className="text-primary font-bold text-xs flex items-center gap-1 shrink-0">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>Completed</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};
