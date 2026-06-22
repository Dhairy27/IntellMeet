import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { extractErrorMessage } from '../utils/extractError';
import {
  Video,
  Calendar,
  UserPlus,
  Clock,
  ArrowRight,
  FileText,
  CheckSquare,
  TrendingUp,
  Play,
  Lock,
  Share2,
  Trash2,
  CalendarDays
} from 'lucide-react';

import { ROOM_CODE_REGEX } from '../constants/room';

interface DashboardProps {
  navigateToMeeting: (roomId: string) => void;
  navigateToPostMeeting: (meetingId: string) => void;
}

export default function Dashboard({ navigateToMeeting, navigateToPostMeeting }: DashboardProps) {
  const { currentWorkspace, user } = useAppStore();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action States
  const [joinRoomId, setJoinRoomId] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  // Scheduling States
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [scheduledEndTime, setScheduledEndTime] = useState('');

  // Feedback States
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createError, setCreateError] = useState('');

  const fetchRecentNotes = async (meetingList: any[]) => {
    const list = Array.isArray(meetingList) ? meetingList : [];
    if (list.length === 0) {
      setNotes([]);
      return;
    }
    try {
      // Fetch notes for the top 5 meetings in this workspace
      const topMeetings = list.slice(0, 5);
      const notesPromises = topMeetings.map(m => api.get(`/meetings/${m?._id}/notes`));
      const results = await Promise.all(notesPromises);

      const allNotes: any[] = [];
      results.forEach((res, index) => {
        if (res && res.success && Array.isArray(res.data)) {
          res.data.forEach((note: any) => {
            allNotes.push({
              ...note,
              meetingId: topMeetings[index]?._id,
              meetingTitle: topMeetings[index]?.title || 'Untitled Meeting',
            });
          });
        }
      });
      // Sort by creation date desc
      allNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(allNotes.slice(0, 5));
    } catch (e) {
      console.error('Failed to fetch recent notes', e);
    }
  };

  const fetchMeetings = async () => {
    if (!currentWorkspace?._id) {
      setMeetings([]);
      setNotes([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/meetings?workspaceId=${currentWorkspace._id}`);
      if (res && res.success && Array.isArray(res.data)) {
        setMeetings(res.data);
        fetchRecentNotes(res.data);
      } else {
        setMeetings([]);
        setNotes([]);
      }
    } catch (e) {
      console.error('Failed to fetch meetings', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [currentWorkspace]);

  const handleStartInstantMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    if (!meetingTitle.trim()) return;

    try {
      if (isScheduled) {
        // Schedule a future meeting
        if (!scheduledDate || !scheduledStartTime || !scheduledEndTime) {
          setCreateError('Please fill in all scheduled dates and timings');
          return;
        }

        const startISO = new Date(`${scheduledDate}T${scheduledStartTime}`).toISOString();
        const endISO = new Date(`${scheduledDate}T${scheduledEndTime}`).toISOString();

        const res = await api.post('/meetings', {
          title: meetingTitle,
          workspaceId: currentWorkspace?._id,
          status: 'scheduled',
          scheduledStartTime: startISO,
          scheduledEndTime: endISO
        });

        if (res.success) {
          setCreateSuccess('Meeting scheduled successfully!');
          setMeetingTitle('');
          setScheduledDate('');
          setScheduledStartTime('');
          setScheduledEndTime('');
          setIsScheduled(false);
          fetchMeetings();
        } else {
          setCreateError(extractErrorMessage(res.error, 'Failed to schedule meeting'));
        }
      } else {
        // Create active/live meeting instantly
        const res = await api.post('/meetings', {
          title: meetingTitle,
          workspaceId: currentWorkspace?._id,
          status: 'active'
        });

        if (res.success) {
          // Join immediately
          navigateToMeeting(res.data.roomId);
        } else {
          setCreateError(extractErrorMessage(res.error, 'Failed to create meeting'));
        }
      }
    } catch (err) {
      setCreateError('Server error creating meeting');
    }
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinRoomId.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(cleanCode)) {
      alert("Please enter a valid 6-character meeting code.");
      return;
    }
    navigateToMeeting(cleanCode);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSuccess('');
    setInviteError('');
    if (!inviteEmail.trim() || !currentWorkspace) return;

    try {
      const res = await api.post(`/workspaces/${currentWorkspace._id}/invite`, {
        email: inviteEmail
      });

      if (res.success) {
        setInviteSuccess('Team member invitation sent!');
        setInviteEmail('');
      } else {
        setInviteError(extractErrorMessage(res.error, 'Failed to invite user'));
      }
    } catch (err) {
      setInviteError('Server error sending invite');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this note from database?')) return;
    try {
      const res = await api.delete(`/notes/${noteId}`);
      if (res.success) {
        setNotes(notes.filter(n => n._id !== noteId));
      } else {
        alert(extractErrorMessage(res.message, 'Could not delete note.'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl border border-slate-800 bg-slate-900/10 min-h-[400px] max-w-xl mx-auto mt-12">
        <Video className="h-12 w-12 text-indigo-400 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">No Workspace Selected</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Please select an existing workspace from the sidebar or create a new workspace to start managing meetings and team logs.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2 min-h-[400px]">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-650 border-t-transparent animate-spin" />
        Loading dashboard workspace metrics...
      </div>
    );
  }

  // Grouping/Metrics
  const upcomingMeetings = (meetings || []).filter(m => m && m.status === 'scheduled');
  const activeMeetings = (meetings || []).filter(m => m && (m.status === 'live' || m.status === 'active'));
  const completedMeetings = (meetings || []).filter(m => m && (m.status === 'ended' || m.status === 'completed'));

  const totalMeetingsCount = (meetings || []).length;
  const activeMeetingsCount = activeMeetings.length;
  const completedMeetingsCount = completedMeetings.length;
  const totalNotesCount = (notes || []).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border-slate-800/80 welcome-banner-bg">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Welcome back, {user?.name || 'User'}
          </h1>
          <p className="text-indigo-200 text-sm mt-1">
            {currentWorkspace ? `Here's an overview for ${currentWorkspace.name} today.` : 'Manage your meetings and AI collaboration details.'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-indigo-200/80 uppercase tracking-wider">Local Date</p>
          <p className="text-sm font-bold text-indigo-100 mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border-slate-800/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Meetings</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{totalMeetingsCount}</p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
            <Video className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border-slate-800/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Meetings</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeMeetingsCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
            <TrendingUp className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border-slate-800/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed Sessions</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{completedMeetingsCount}</p>
          </div>
          <div className="p-3 bg-slate-850 rounded-lg border border-slate-800 text-slate-400">
            <CheckSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border-slate-800/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Notes</p>
            <p className="text-2xl font-bold text-violet-650 mt-1">{totalNotesCount}</p>
          </div>
          <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/20 text-violet-400">
            <FileText className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Grid Area: Active, Upcoming, and Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Meetings Pane */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col shadow-lg">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              Active Call Sessions
            </h3>
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-full ml-auto">
              {activeMeetings.length} Online
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-1">
            {activeMeetings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500">
                <Video className="h-8 w-8 text-slate-700 mb-2" />
                <p className="text-xs">No call rooms active currently.</p>
                <p className="text-[10px] text-slate-600 mt-1">Start a room or join by code.</p>
              </div>
            ) : (
              activeMeetings.map((m) => (
                <div key={m._id} className="p-3.5 rounded-xl bg-slate-950/45 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-slate-200 truncate">{m.title}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">Code: {m.meetingCode}</p>
                  </div>
                  <button
                    onClick={() => navigateToMeeting(m.roomId)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Meetings Pane */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col shadow-lg">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-3">
            <CalendarDays className="h-4 w-4 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">Scheduled Meetings</h3>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-400 font-bold px-2 py-0.5 rounded-full ml-auto">
              {upcomingMeetings.length} Scheduled
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-1">
            {upcomingMeetings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500">
                <Calendar className="h-8 w-8 text-slate-700 mb-2" />
                <p className="text-xs">No future meetings scheduled.</p>
                <p className="text-[10px] text-slate-600 mt-1">Schedule a meeting via form below.</p>
              </div>
            ) : (
              upcomingMeetings.map((m) => (
                <div key={m._id} className="p-3.5 rounded-xl bg-slate-950/45 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 truncate">{m.title}</h4>
                    <span className="text-[9px] bg-slate-850 px-2 py-0.5 rounded border border-slate-800 text-slate-400 font-mono">
                      {m.meetingCode}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-indigo-400" />
                    {new Date(m.scheduledStartTime).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                  <button
                    onClick={() => navigateToMeeting(m.roomId)}
                    className="mt-3 w-full py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold rounded-lg text-[10px] transition-colors cursor-pointer text-center"
                  >
                    Start Scheduled Session
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Notes Pane */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col shadow-lg">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-3">
            <FileText className="h-4 w-4 text-violet-400" />
            <h3 className="font-semibold text-slate-100">Recent Meeting Notes</h3>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-1">
            {notes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500">
                <FileText className="h-8 w-8 text-slate-700 mb-2" />
                <p className="text-xs">No saved meeting notes found.</p>
                <p className="text-[10px] text-slate-600 mt-1">Launch a call and write notes in sidebar.</p>
              </div>
            ) : (
              notes.map((note) => (
                <div key={note._id} className="p-3 rounded-xl bg-slate-950/45 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col relative group">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {note.type === 'personal' ? (
                      <span title="Private Personal Note"><Lock className="h-3 w-3 text-amber-500/80" /></span>
                    ) : (
                      <span title="Shared Note"><Share2 className="h-3 w-3 text-indigo-400/80" /></span>
                    )}
                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]" title={`Meeting: ${note.meetingTitle}`}>
                      {note.meetingTitle}
                    </span>
                    <span className="text-[9px] text-slate-500 ml-auto">
                      {new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2 border-t border-slate-900/80 pt-1.5 text-[9px] text-slate-400">
                    {note.userId?.avatar && (note.userId.avatar.startsWith('http://') || note.userId.avatar.startsWith('https://')) ? (
                      <img
                        src={note.userId.avatar}
                        alt={note.userId.name || 'Author'}
                        className="h-3.5 w-3.5 rounded-full object-cover shrink-0 border border-white/10"
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: note.userId?.avatar || '#6366f1' }}
                        className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white uppercase shrink-0"
                      >
                        {note.userId?.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <span>{note.userId?.name || 'Author'}</span>
                    
                    {note.userId?._id === user?.id && (
                      <button
                        onClick={() => handleDeleteNote(note._id)}
                        className="ml-auto text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Action Forms Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Start / Schedule Meeting */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Video className="h-4.5 w-4.5" />
              </div>
              <h3 className="font-semibold text-slate-100">Launch or Schedule</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Instantly create a live workspace call, or schedule a future session for your team.
            </p>
            {createError && <p className="text-rose-400 text-xs mb-3 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1">{createError}</p>}
            {createSuccess && <p className="text-emerald-400 text-xs mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">{createSuccess}</p>}
          </div>

          <form onSubmit={handleStartInstantMeeting} className="space-y-3.5">
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Enter meeting title..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
            />

            <div className="flex items-center gap-2 pb-1">
              <input
                type="checkbox"
                id="isScheduled"
                checked={isScheduled}
                onChange={(e) => {
                  setIsScheduled(e.target.checked);
                  setCreateError('');
                  setCreateSuccess('');
                }}
                className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="isScheduled" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                Schedule for a future date
              </label>
            </div>

            {isScheduled && (
              <div className="space-y-2.5 bg-slate-950/40 border border-slate-850 p-2.5 rounded-lg animate-fadeIn">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Start Time</label>
                    <input
                      type="time"
                      value={scheduledStartTime}
                      onChange={(e) => setScheduledStartTime(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">End Time</label>
                    <input
                      type="time"
                      value={scheduledEndTime}
                      onChange={(e) => setScheduledEndTime(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md"
            >
              {isScheduled ? 'Schedule Meeting' : 'Launch Live Room'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Join Meeting by Code */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <h3 className="font-semibold text-slate-100">Join via Code</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Enter a 6-character meeting code (e.g. ABC123) to join.
            </p>
          </div>
          <form onSubmit={handleJoinMeeting} className="space-y-3">
            <input
              type="text"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="e.g. ABC123"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-center tracking-widest font-mono text-slate-200 font-bold uppercase"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md"
            >
              Enter Room
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Invite Workspace Member */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-violet-500/10 text-violet-400 rounded-lg border border-violet-500/20">
                <UserPlus className="h-4.5 w-4.5" />
              </div>
              <h3 className="font-semibold text-slate-100">Add Team Member</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {currentWorkspace
                ? `Grant user access to collaborate in "${currentWorkspace.name}" workspace.`
                : 'Please select or create a workspace first.'}
            </p>
            {inviteSuccess && <p className="text-emerald-400 text-xs mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">{inviteSuccess}</p>}
            {inviteError && <p className="text-rose-400 text-xs mb-3 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1">{inviteError}</p>}
          </div>
          <form onSubmit={handleInviteUser} className="space-y-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              disabled={!currentWorkspace}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200"
            />
            <button
              type="submit"
              disabled={!currentWorkspace}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md"
            >
              Invite Member
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Meeting History Section */}
      <div className="glass-panel rounded-2xl border-slate-800/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between bg-slate-850/40">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-indigo-400" />
            Meeting Session Logs
          </h3>
          <button
            onClick={fetchMeetings}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            Refresh Logs
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-650 border-t-transparent animate-spin" />
            Loading historical data...
          </div>
        ) : completedMeetings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No completed meeting logs found in this workspace. Launch or complete one to see logs!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/20">
                  <th className="px-6 py-3.5 font-semibold">Title</th>
                  <th className="px-6 py-3.5 font-semibold">Date & Time</th>
                  <th className="px-6 py-3.5 font-semibold">Organizer</th>
                  <th className="px-6 py-3.5 font-semibold">Duration</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {completedMeetings.map((meeting) => (
                  <tr key={meeting._id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-200">
                      {meeting.title}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(meeting.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div className="flex items-center gap-2">
                        {meeting.host?.avatar && (meeting.host.avatar.startsWith('http://') || meeting.host.avatar.startsWith('https://')) ? (
                          <img
                            src={meeting.host.avatar}
                            alt={meeting.host.name || 'Host'}
                            className="h-6 w-6 rounded-full object-cover shrink-0 border border-white/10"
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: meeting.host?.avatar || '#6366f1' }}
                            className="h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                          >
                            {meeting.host?.name?.charAt(0).toUpperCase() || 'H'}
                          </div>
                        )}
                        <span>{meeting.host?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {meeting.actualStartTime && meeting.actualEndTime ? (
                        `${Math.round((new Date(meeting.actualEndTime).getTime() - new Date(meeting.actualStartTime).getTime()) / 60000)} min`
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigateToPostMeeting(meeting._id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-indigo-300 hover:text-indigo-200 rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
                      >
                        <FileText className="h-3 w-3" />
                        AI Summary
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
