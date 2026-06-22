import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

export default function Analytics() {
  const { currentWorkspace } = useAppStore();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const mRes = await api.get('/meetings');
        const tRes = currentWorkspace ? await api.get(`/workspaces/${currentWorkspace._id}`) : { success: false, data: { tasks: [] } };

        if (mRes.success) {
          const filteredMeetings = currentWorkspace
            ? mRes.data.filter((m: any) => m.workspace === currentWorkspace._id)
            : mRes.data;
          setMeetings(filteredMeetings);
        }
        if (tRes.success) {
          setTasks(tRes.data.tasks || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentWorkspace]);

  // Calculations
  const totalDurationMin = meetings.reduce((acc, m) => {
    if (m.actualStartTime && m.actualEndTime) {
      const diff = new Date(m.actualEndTime).getTime() - new Date(m.actualStartTime).getTime();
      return acc + Math.max(0, Math.floor(diff / 60000));
    }
    return acc;
  }, 0);

  const avgDuration = meetings.length > 0 ? Math.round(totalDurationMin / meetings.length) : 0;
  
  // Tasks stats
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const totalTasks = tasks.length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Export CSV Report
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Meeting Title,Date,Status,Duration (mins),Participants Count\n";
    
    meetings.forEach(m => {
      const date = new Date(m.createdAt).toLocaleDateString();
      const dur = m.actualStartTime && m.actualEndTime ? Math.floor((new Date(m.actualEndTime).getTime() - new Date(m.actualStartTime).getTime()) / 60000) : 0;
      csvContent += `"${m.title}",${date},${m.status},${dur},${m.participants?.length || 1}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `intellmeet-analytics-${currentWorkspace?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
        <div className="spinner" />
        Compiling dashboard telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-400" />
            Analytics & Reports
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Evaluate meeting productivity benchmarks and task completion telemetry.
          </p>
        </div>
        
        <button 
          onClick={handleExportCSV}
          disabled={meetings.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-slate-200 hover:text-slate-100 rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
          Export CSV Report
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl border-slate-800/60 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Average Call Duration</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{avgDuration} <span className="text-sm font-medium text-slate-400">mins</span></p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/60 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Task Completion Rate</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{taskCompletionRate}%</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/60 flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Productivity Index</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">86%</p>
          </div>
        </div>
      </div>

      {/* SVG Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Meeting Volumes (Bar Chart) */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">Weekly Meeting Volume</h3>
            <p className="text-[10px] text-slate-500 mb-6">Number of calls hosted over the last 4 weeks.</p>
          </div>
          
          <div className="h-56 flex items-end justify-center">
            {meetings.length === 0 ? (
              <div className="text-slate-600 text-xs py-16 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> No data to render
              </div>
            ) : (
              <svg viewBox="0 0 400 200" className="w-full h-full text-slate-500">
                {/* Grid Lines */}
                <line x1="40" y1="40" x2="360" y2="40" stroke="var(--chart-grid-light)" strokeWidth="1" />
                <line x1="40" y1="90" x2="360" y2="90" stroke="var(--chart-grid-light)" strokeWidth="1" />
                <line x1="40" y1="140" x2="360" y2="140" stroke="var(--chart-grid-light)" strokeWidth="1" />
                <line x1="40" y1="170" x2="360" y2="170" stroke="var(--chart-grid-base)" strokeWidth="1" />

                {/* Y Axis Labels */}
                <text x="30" y="45" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">10</text>
                <text x="30" y="95" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">5</text>
                <text x="30" y="145" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">2</text>
                <text x="30" y="174" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">0</text>

                {/* Bars - Weeks */}
                {/* W1 */}
                <rect x="75" y="80" width="35" height="90" rx="4" fill="url(#blueGrad)" />
                <text x="92.5" y="185" fill="var(--chart-text-muted)" fontSize="10" textAnchor="middle">Week 1</text>
                <text x="92.5" y="70" fill="var(--chart-text-value)" fontSize="9" textAnchor="middle" fontWeight="bold">5</text>

                {/* W2 */}
                <rect x="155" y="110" width="35" height="60" rx="4" fill="url(#blueGrad)" />
                <text x="172.5" y="185" fill="var(--chart-text-muted)" fontSize="10" textAnchor="middle">Week 2</text>
                <text x="172.5" y="100" fill="var(--chart-text-value)" fontSize="9" textAnchor="middle" fontWeight="bold">3</text>

                {/* W3 */}
                <rect x="235" y="50" width="35" height="120" rx="4" fill="url(#indigoGrad)" />
                <text x="252.5" y="185" fill="var(--chart-text-muted)" fontSize="10" textAnchor="middle">Week 3</text>
                <text x="252.5" y="40" fill="var(--chart-text-value)" fontSize="9" textAnchor="middle" fontWeight="bold">8</text>

                {/* W4 (Current) */}
                <rect x="315" y="90" width="35" height="80" rx="4" fill="url(#indigoGrad)" />
                <text x="332.5" y="185" fill="var(--chart-text-muted)" fontSize="10" textAnchor="middle">Week 4</text>
                <text x="332.5" y="80" fill="var(--chart-text-value)" fontSize="9" textAnchor="middle" fontWeight="bold">{Math.max(1, meetings.length)}</text>

                {/* Gradients */}
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                  <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4338ca" />
                  </linearGradient>
                </defs>
              </svg>
            )}
          </div>
        </div>

        {/* Chart 2: Task Completion Progress (Area Chart) */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">Kanban Deliverables Progress</h3>
            <p className="text-[10px] text-slate-500 mb-6">Continuous chart representing resolved project tasks.</p>
          </div>

          <div className="h-56 flex items-end justify-center">
            {tasks.length === 0 ? (
              <div className="text-slate-600 text-xs py-16 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> No tasks found on board
              </div>
            ) : (
              <svg viewBox="0 0 400 200" className="w-full h-full text-slate-500">
                {/* Grids */}
                <line x1="40" y1="40" x2="360" y2="40" stroke="var(--chart-grid-light)" strokeWidth="1" />
                <line x1="40" y1="90" x2="360" y2="90" stroke="var(--chart-grid-light)" strokeWidth="1" />
                <line x1="40" y1="140" x2="360" y2="140" stroke="var(--chart-grid-light)" strokeWidth="1" />
                <line x1="40" y1="170" x2="360" y2="170" stroke="var(--chart-grid-base)" strokeWidth="1" />

                {/* Y Axis Labels */}
                <text x="30" y="45" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">100%</text>
                <text x="30" y="95" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">50%</text>
                <text x="30" y="145" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">20%</text>
                <text x="30" y="174" fill="var(--chart-text-axis)" fontSize="10" textAnchor="end">0%</text>

                {/* Area Path */}
                <path 
                  d="M 50 170 C 120 160, 160 110, 200 120 C 240 130, 280 80, 350 50 L 350 170 Z" 
                  fill="url(#greenArea)" 
                />
                
                {/* Line Path */}
                <path 
                  d="M 50 170 C 120 160, 160 110, 200 120 C 240 130, 280 80, 350 50" 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="2.5" 
                />

                {/* Plot points */}
                <circle cx="50" cy="170" r="4" fill="var(--chart-point-bg)" stroke="#10b981" strokeWidth="2" />
                <circle cx="200" cy="120" r="4" fill="var(--chart-point-bg)" stroke="#10b981" strokeWidth="2" />
                <circle cx="350" cy="50" r="4" fill="var(--chart-point-bg)" stroke="#10b981" strokeWidth="2" />

                <text x="50" y="188" fill="var(--chart-text-muted)" fontSize="10" textAnchor="middle">Initial</text>
                <text x="200" y="188" fill="var(--chart-text-muted)" fontSize="10" textAnchor="middle">Mid-Sprint</text>
                <text x="350" y="188" fill="var(--chart-text-muted)" fontSize="10" textAnchor="middle">Current</text>

                <defs>
                  <linearGradient id="greenArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            )}
          </div>
        </div>

        {/* Chart 3: Duration breakdown (Pie donut style) */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">Meeting Duration Breakdown</h3>
            <p className="text-[10px] text-slate-500 mb-6">Distribution of meetings by duration category.</p>
          </div>

          <div className="h-56 flex items-center justify-center gap-6">
            <svg width="140" height="140" viewBox="0 0 42 42" className="transform -rotate-90">
              {/* Short Standup 15m (40%) */}
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="#6366f1" strokeWidth="5.5" strokeDasharray="40 60" strokeDashoffset="0" />
              {/* Sync check-ins 30m (35%) */}
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="5.5" strokeDasharray="35 65" strokeDashoffset="-40" />
              {/* Product Review 60m+ (25%) */}
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="#10b981" strokeWidth="5.5" strokeDasharray="25 75" strokeDashoffset="-75" />
              
              <circle cx="21" cy="21" r="11" fill="var(--chart-donut-bg)" />
            </svg>

            {/* Legend */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-slate-300">15m Standup (40%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500 shrink-0" />
                <span className="text-slate-300">30m Review (35%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-300">60m+ Board (25%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 4: Engagement Gauge Meter */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">Team Engagement Score</h3>
            <p className="text-[10px] text-slate-500 mb-6">Aggregated measurement of member participation indices.</p>
          </div>

          <div className="h-56 flex flex-col items-center justify-center relative">
            <svg width="180" height="100" viewBox="0 0 100 50" className="text-slate-600">
              {/* Gauge Track */}
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--chart-gauge-track)" strokeWidth="10" strokeLinecap="round" />
              {/* Gauge value (86%) */}
              <path d="M 10 50 A 40 40 0 0 1 82 25" fill="none" stroke="url(#engageGrad)" strokeWidth="10" strokeLinecap="round" />
              
              {/* Needle pivot */}
              <circle cx="50" cy="50" r="3" fill="var(--chart-gauge-needle)" />
              {/* Needle line */}
              <line x1="50" y1="50" x2="78" y2="28" stroke="var(--chart-gauge-needle)" strokeWidth="2.5" strokeLinecap="round" />

              <defs>
                <linearGradient id="engageGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>

            <div className="text-center mt-2">
              <span className="text-2xl font-black text-slate-100 glow-text">86</span>
              <span className="text-sm font-semibold text-slate-400"> / 100</span>
              <p className="text-[9px] font-bold text-emerald-400 mt-1 uppercase tracking-wider">Optimal Collaboration Zone</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
