import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAppStore } from '../store';
import { Lock, Share2, Save, Trash2, Edit3, Plus, Loader2 } from 'lucide-react';

interface NotePadProps {
  meetingId: string;
  sharedNotesText: string;
  onSharedNotesChange: (text: string) => void;
}

interface DBNote {
  _id: string;
  meetingId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    avatar: string;
  };
  content: string;
  type: 'personal' | 'shared';
  createdAt: string;
}

export default function NotePad({ meetingId, sharedNotesText, onSharedNotesChange }: NotePadProps) {
  const { user } = useAppStore();
  const [tab, setTab] = useState<'shared' | 'personal'>('shared');
  const [personalNotesText, setPersonalNotesText] = useState('');
  const [savedNotes, setSavedNotes] = useState<DBNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingShared, setSavingShared] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  
  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const fetchSavedNotes = async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const res = await api.get(`/meetings/${meetingId}/notes`);
      if (res.success) {
        setSavedNotes(res.data);
      }
    } catch (err) {
      console.error('Error fetching saved notes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedNotes();
  }, [meetingId]);

  // Save collaborative notes to DB as a shared note
  const handleSaveSharedToDB = async () => {
    if (!sharedNotesText.trim()) return;
    setSavingShared(true);
    try {
      const res = await api.post(`/meetings/${meetingId}/notes`, {
        content: sharedNotesText,
        type: 'shared'
      });
      if (res.success) {
        // Refresh saved notes list
        fetchSavedNotes();
        alert('Shared note saved to meeting logs!');
      }
    } catch (err) {
      console.error('Error saving shared note', err);
    } finally {
      setSavingShared(false);
    }
  };

  // Save private note to DB
  const handleSavePersonalToDB = async () => {
    if (!personalNotesText.trim()) return;
    setSavingPersonal(true);
    try {
      const res = await api.post(`/meetings/${meetingId}/notes`, {
        content: personalNotesText,
        type: 'personal'
      });
      if (res.success) {
        setPersonalNotesText('');
        fetchSavedNotes();
      }
    } catch (err) {
      console.error('Error saving personal note', err);
    } finally {
      setSavingPersonal(false);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      const res = await api.delete(`/notes/${noteId}`);
      if (res.success) {
        setSavedNotes(savedNotes.filter(n => n._id !== noteId));
      }
    } catch (err) {
      console.error('Error deleting note', err);
    }
  };

  // Start edit note
  const startEditNote = (note: DBNote) => {
    setEditingNoteId(note._id);
    setEditingContent(note.content);
  };

  // Submit edit note
  const handleSaveEdit = async (noteId: string) => {
    if (!editingContent.trim()) return;
    try {
      const res = await api.put(`/notes/${noteId}`, { content: editingContent });
      if (res.success) {
        setEditingNoteId(null);
        setSavedNotes(savedNotes.map(n => n._id === noteId ? { ...n, content: editingContent } : n));
      }
    } catch (err) {
      console.error('Error updating note', err);
    }
  };

  const sharedNotesList = savedNotes.filter(n => n.type === 'shared');
  const personalNotesList = savedNotes.filter(n => n.type === 'personal');

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Tabs */}
      <div className="flex bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
        <button
          onClick={() => setTab('shared')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
            tab === 'shared'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="h-3.5 w-3.5" />
          Collaborative
        </button>
        <button
          onClick={() => setTab('personal')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
            tab === 'personal'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          Personal
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 flex flex-col min-h-0">
        {tab === 'shared' ? (
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">
                Real-Time Shared Note
              </span>
              <button
                onClick={handleSaveSharedToDB}
                disabled={savingShared || !sharedNotesText.trim()}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {savingShared ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save to Logs
              </button>
            </div>
            
            <textarea
              value={sharedNotesText}
              onChange={(e) => onSharedNotesChange(e.target.value)}
              placeholder="Start drafting shared notes... Collaborators can see this in real time!"
              className="flex-1 w-full min-h-[120px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs focus:outline-none focus:border-indigo-500 resize-none text-slate-200 font-mono leading-relaxed"
            />

            {/* Saved Shared Notes Logs */}
            <div className="flex-1 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Saved Shared Logs
              </h4>
              {loading ? (
                <div className="text-center py-4 text-[10px] text-slate-500 flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                  Loading notes...
                </div>
              ) : sharedNotesList.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic py-2">
                  No shared notes saved yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {sharedNotesList.map((note) => (
                    <div key={note._id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/20 text-xs text-slate-300 relative group">
                      {editingNoteId === note._id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 border border-slate-800 rounded font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(note._id)}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-0.5 border border-indigo-900/50 rounded font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {note.userId?.avatar && (note.userId.avatar.startsWith('http://') || note.userId.avatar.startsWith('https://')) ? (
                              <img
                                src={note.userId.avatar}
                                alt={note.userId.name || 'User'}
                                className="h-4 w-4 rounded-full object-cover border border-white/10"
                              />
                            ) : (
                              <div
                                style={{ backgroundColor: note.userId?.avatar || '#6366f1' }}
                                className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white uppercase"
                              >
                                {note.userId?.name?.charAt(0) || 'U'}
                              </div>
                            )}
                            <span className="text-[10px] text-slate-400 font-semibold">{note.userId?.name || 'User'}</span>
                            <span className="text-[9px] text-slate-500 ml-auto">
                              {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed">{note.content}</p>
                          
                          {note.userId?._id === user?.id && (
                            <div className="absolute right-2.5 bottom-2.5 hidden group-hover:flex items-center gap-1.5 bg-slate-900/90 p-1 rounded border border-slate-800">
                              <button
                                onClick={() => startEditNote(note)}
                                className="text-slate-400 hover:text-indigo-400 cursor-pointer"
                                title="Edit note"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note._id)}
                                className="text-slate-400 hover:text-rose-400 cursor-pointer"
                                title="Delete note"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
            <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">
              Private Note (Only Viewable by You)
            </span>
            <div className="relative">
              <textarea
                value={personalNotesText}
                onChange={(e) => setPersonalNotesText(e.target.value)}
                placeholder="Write down personal remarks or to-dos..."
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs focus:outline-none focus:border-indigo-500 resize-none text-slate-200 font-mono leading-relaxed"
              />
              <button
                onClick={handleSavePersonalToDB}
                disabled={savingPersonal || !personalNotesText.trim()}
                className="absolute right-2 bottom-3 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md cursor-pointer shadow"
                title="Save personal note"
              >
                {savingPersonal ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Saved Personal Notes List */}
            <div className="flex-1 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Private Journal
              </h4>
              {loading ? (
                <div className="text-center py-4 text-[10px] text-slate-500 flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                  Loading journal...
                </div>
              ) : personalNotesList.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic py-2">
                  No personal notes logged for this meeting.
                </p>
              ) : (
                <div className="space-y-2">
                  {personalNotesList.map((note) => (
                    <div key={note._id} className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs text-slate-300 relative group">
                      {editingNoteId === note._id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 border border-slate-800 rounded font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(note._id)}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-0.5 border border-indigo-900/50 rounded font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 mb-1">
                            <Lock className="h-3 w-3 text-slate-500" />
                            <span className="text-[9px] text-slate-500">
                              {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed">{note.content}</p>
                          
                          <div className="absolute right-2.5 bottom-2.5 hidden group-hover:flex items-center gap-1.5 bg-slate-900/90 p-1 rounded border border-slate-800">
                            <button
                              onClick={() => startEditNote(note)}
                              className="text-slate-400 hover:text-indigo-400 cursor-pointer"
                              title="Edit note"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note._id)}
                              className="text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Delete note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
