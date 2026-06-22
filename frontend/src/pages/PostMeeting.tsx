import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { extractErrorMessage } from '../utils/extractError';
import { 
  ArrowLeft, 
  Sparkles, 
  CheckSquare, 
  FileText, 
  Play, 
  Pause, 
  Download, 
  Users, 
  Clock, 
  Briefcase,
  Search,
  CheckCircle
} from 'lucide-react';

const parseMarkdownToHtml = (markdown: string) => {
  if (!markdown) return '';
  
  const lines = markdown.split('\n');
  let inList = false;
  
  const htmlLines = lines.map(line => {
    let trimmed = line.trim();
    
    // Headers
    if (trimmed.startsWith('### ')) {
      const headerText = trimmed.slice(4);
      const prefix = inList ? '</ul>' : '';
      inList = false;
      return `${prefix}<h3 class="text-sm font-bold text-slate-100 mt-5 mb-2">${headerText}</h3>`;
    }
    if (trimmed.startsWith('#### ')) {
      const headerText = trimmed.slice(5);
      const prefix = inList ? '</ul>' : '';
      inList = false;
      return `${prefix}<h4 class="text-xs font-semibold text-slate-200 mt-4 mb-1.5 uppercase tracking-wide">${headerText}</h4>`;
    }
    
    // Bullet list items
    if (trimmed.startsWith('- ')) {
      let content = trimmed.slice(2);
      // Process bold inside list item
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      let result = '';
      if (!inList) {
        inList = true;
        result = '<ul class="list-disc pl-4 space-y-1.5 my-2">';
      }
      return `${result}<li class="text-slate-300 font-normal">${content}</li>`;
    }
    
    // If we were in a list and this line is not a list item, close the list
    let prefix = '';
    if (inList && trimmed !== '') {
      inList = false;
      prefix = '</ul>';
    }
    
    if (trimmed === '') {
      if (inList) {
        inList = false;
        return '</ul>';
      }
      return '<div class="h-2"></div>'; // spacer for empty lines
    }
    
    // Standard text line
    let content = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return `${prefix}<p class="text-slate-300 leading-relaxed mb-2 font-normal">${content}</p>`;
  });
  
  if (inList) {
    htmlLines.push('</ul>');
  }
  
  return htmlLines.join('\n');
};

interface PostMeetingProps {
  meetingId: string | null;
  onBack: () => void;
}

export default function PostMeeting({ meetingId, onBack }: PostMeetingProps) {
  const { workspaces, currentWorkspace } = useAppStore();
  const isRecordingEnabled = import.meta.env.VITE_RECORDING_ENABLED !== 'false';
  const [meeting, setMeeting] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'action-items' | 'transcript'>('summary');
  
  // Media Player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Search Transcript state
  const [searchQuery, setSearchQuery] = useState('');

  // Task conversion state
  const [selectedWorkspace, setSelectedWorkspace] = useState(currentWorkspace?._id || '');
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchMeetingDetails = async () => {
    if (!meetingId) return;
    try {
      setLoading(true);
      const res = await api.get(`/meetings/${meetingId}`);
      if (res.success) {
        setMeeting(res.data);
      }
      
      const recRes = await api.get(`/meetings/${meetingId}/recordings`);
      if (recRes.success) {
        setRecordings(recRes.data || []);
      }
    } catch (e) {
      console.error('Failed to load meeting details', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingDetails();
  }, [meetingId]);

  // Sync selected workspace
  useEffect(() => {
    if (currentWorkspace) {
      setSelectedWorkspace(currentWorkspace._id);
    }
  }, [currentWorkspace]);

  // Media Player Actions
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Convert AI Action Item to Project Kanban card
  const handleConvertAction = async (actionItemId: string) => {
    if (!meeting || !selectedWorkspace) return;
    setConvertingId(actionItemId);

    try {
      const res = await api.post(`/meetings/${meeting._id}/convert-action`, {
        actionItemId,
        workspaceId: selectedWorkspace
      });

      if (res.success) {
        // Refresh local data to show "converted" status
        await fetchMeetingDetails();
        alert('Action item successfully converted to a Workspace Task!');
      } else {
        alert(extractErrorMessage(res.error, 'Failed to convert action item to task'));
      }
    } catch (err) {
      console.error(err);
      alert('Error communicating with server.');
    } finally {
      setConvertingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
        <div className="spinner" />
        Processing meeting intelligence summaries...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center p-12 space-y-4">
        <p className="text-slate-400 text-xs">Meeting details could not be located.</p>
        <button onClick={onBack} className="text-indigo-400 text-xs hover:underline flex items-center gap-2 mx-auto">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </button>
      </div>
    );
  }

  // Format Duration
  const getDuration = () => {
    if (!meeting.actualStartTime || !meeting.actualEndTime) return 'N/A';
    const diffMs = new Date(meeting.actualEndTime).getTime() - new Date(meeting.actualStartTime).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  };

  // Filter Transcript
  const filteredTranscript = meeting.transcript?.filter((t: any) => 
    t.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.text.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Navigation */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      {/* Header Info */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase">
                AI Processed
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-400 text-xs">
                {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 mt-1.5 tracking-tight">
              {meeting.title}
            </h1>
          </div>
          
          {(recordings.length > 0 || meeting.recordingUrl) && (
            <div className="flex gap-2">
              <a 
                href={recordings.length > 0 ? recordings[0].recordingUrl : meeting.recordingUrl} 
                download
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/60 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download Audio
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/50 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-indigo-400" />
            <span>Duration: <strong className="text-slate-200">{getDuration()}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-indigo-400" />
            <span>Participants: <strong className="text-slate-200">{meeting.participants?.length || 1} team members</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4.5 w-4.5 text-indigo-400" />
            <span>Workspace: <strong className="text-slate-200">{meeting.workspace?.name || 'Personal Space'}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Player and Intelligence Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Custom Video/Audio Playback Panel */}
        {isRecordingEnabled && (
          <div className="glass-panel rounded-2xl border-slate-800/60 overflow-hidden bg-slate-900/30 flex flex-col justify-between shadow-sm">
            <div className="p-5 border-b border-slate-850 bg-slate-900/40">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Play className="h-4 w-4 text-indigo-400" />
                Session Playback Recording
              </h3>
            </div>
            
            {(recordings.length > 0 || meeting.recordingUrl) ? (
              <>
                <div className="p-5 flex-1 flex flex-col justify-center bg-slate-950/20">
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <video 
                      ref={videoRef}
                      src={recordings.length > 0 ? recordings[0].recordingUrl : meeting.recordingUrl}
                      onTimeUpdate={handleTimeUpdate}
                      className="w-full h-full object-cover"
                    />
                    {!isPlaying && (
                      <button 
                        onClick={handlePlayPause}
                        className="absolute p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl hover:scale-105 transition-all cursor-pointer border border-indigo-400/20"
                      >
                        <Play className="h-6 w-6 fill-current" />
                      </button>
                    )}
                  </div>

                  {/* Custom Control Progress bar */}
                  <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
                    <div className="flex-1 mx-3 h-1.5 bg-slate-850 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${videoRef.current ? (currentTime / videoRef.current.duration) * 100 : 0}%` }}
                        className="h-full bg-indigo-500 rounded-full"
                      />
                    </div>
                    <span>Video Playback</span>
                  </div>
                </div>

                <div className="p-5 border-t border-slate-850 bg-slate-900/40 flex justify-center gap-4">
                  <button 
                    onClick={handlePlayPause}
                    className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700/50"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {isPlaying ? 'Pause' : 'Play Meeting'}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 flex-1 flex flex-col items-center justify-center text-center text-slate-400 gap-2 min-h-[220px]">
                <Play className="h-8 w-8 text-slate-650" />
                <p className="text-xs font-medium">No meeting recordings available.</p>
              </div>
            )}
          </div>
        )}

        {/* Tabs and Data Panel */}
        <div className={isRecordingEnabled ? "lg:col-span-2 flex flex-col glass-panel rounded-2xl border-slate-800/60 overflow-hidden shadow-sm" : "lg:col-span-3 flex flex-col glass-panel rounded-2xl border-slate-800/60 overflow-hidden shadow-sm"}>
          
          {/* Tab Selector Header */}
          <div className="h-12 border-b border-slate-850 bg-slate-850/50 flex items-center px-4">
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'summary' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Summary
              </button>

              <button 
                onClick={() => setActiveTab('action-items')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'action-items' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Action Items ({meeting.aiActionItems?.length || 0})
              </button>

              <button 
                onClick={() => setActiveTab('transcript')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'transcript' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Transcript
              </button>
            </div>
          </div>

          {/* View Container */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[420px]">
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  AI Summarized Notes
                </h4>
                {meeting.aiSummary ? (
                  <div 
                    className="text-xs leading-relaxed text-slate-300 space-y-3 font-normal"
                    dangerouslySetInnerHTML={{ 
                      __html: parseMarkdownToHtml(meeting.aiSummary)
                    }}
                  />
                ) : (
                  <p className="text-slate-500 text-xs italic">No AI summary generated for this session.</p>
                )}
              </div>
            )}

            {activeTab === 'action-items' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                      Extracted Tasks & Ownerships
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Convert action items directly into Kanban board issues.
                    </p>
                  </div>
                  {/* Select workspace context */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">Destination Workspace:</span>
                    <select
                      value={selectedWorkspace}
                      onChange={(e) => setSelectedWorkspace(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
                    >
                      {workspaces.map((w) => (
                        <option key={w._id} value={w._id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!meeting.aiActionItems || meeting.aiActionItems.length === 0 ? (
                  <p className="text-slate-500 text-xs italic py-6 text-center">No action items extracted from the dialog logs.</p>
                ) : (
                  <div className="space-y-4">
                    {meeting.aiActionItems.map((item: any, i: number) => {
                      const isConverted = item.status === 'converted';
                      return (
                        <div 
                          key={item._id || i}
                          className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-200">{item.task}</p>
                            <div className="flex items-center gap-2 text-[10px]">
                              {item.suggestedAssignee && (
                                <span className="text-slate-400">
                                  Suggested: <strong className="text-indigo-400">{item.suggestedAssignee}</strong>
                                </span>
                              )}
                              <span className="text-slate-600">•</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                item.priority === 'high' ? 'bg-rose-500/10 text-rose-400' :
                                item.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {item.priority} priority
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isConverted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/5 border border-emerald-500/15 px-2.5 py-1 rounded-lg">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Synced
                              </span>
                            ) : (
                              <button 
                                onClick={() => handleConvertAction(item._id)}
                                disabled={convertingId === item._id || !selectedWorkspace}
                                className="py-1 px-2.5 bg-indigo-650 hover:bg-indigo-650 text-white rounded text-[10px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {convertingId === item._id && <div className="spinner h-3.5 w-3.5" />}
                                Convert Card
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search transcripts by speaker or keywords..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
                  />
                </div>

                <div className="space-y-4 mt-4">
                  {!meeting.transcript || meeting.transcript.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-6 text-center">No verbal transcript was recorded.</p>
                  ) : filteredTranscript.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-6 text-center">No transcript results match your search query.</p>
                  ) : (
                    filteredTranscript.map((line: any, i: number) => (
                      <div key={i} className="border-l-2 border-slate-800 pl-3.5 py-0.5">
                        <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">
                          {line.speaker}
                        </span>
                        <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                          {line.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
