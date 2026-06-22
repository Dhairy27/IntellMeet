import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { extractErrorMessage } from '../utils/extractError';
import { Shield, Trash2, Edit3, Save, Info, AlertTriangle } from 'lucide-react';

export default function WorkspaceSettings() {
  const { currentWorkspace, setWorkspaces, setCurrentWorkspace } = useAppStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [userRole, setUserRole] = useState('Member');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchDetails = async () => {
      if (!currentWorkspace) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get(`/workspaces/${currentWorkspace._id}`);
        if (res && res.success && res.data?.workspace) {
          setName(res.data.workspace.name);
          setDescription(res.data.workspace.description || '');
          setUserRole(res.data.workspace.userRole || 'Member');
        }
      } catch (err) {
        console.error('Failed to load workspace settings details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [currentWorkspace]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim()) return;
    try {
      setUpdating(true);
      setMessage({ type: '', text: '' });
      const res = await api.put(`/workspaces/${currentWorkspace._id}`, { name, description });
      
      if (res.success) {
        setMessage({ type: 'success', text: 'Workspace details updated successfully!' });
        // Refresh list
        const wRes = await api.get('/workspaces');
        if (wRes.success) {
          setWorkspaces(wRes.data);
          const updated = wRes.data.find((w: any) => w._id === currentWorkspace._id);
          if (updated) setCurrentWorkspace(updated);
        }
      } else {
        setMessage({ type: 'error', text: extractErrorMessage(res.error, 'Failed to update workspace') });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server connection failed.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!currentWorkspace) return;
    const confirmDelete = window.confirm(
      "WARNING: This action is permanent and cannot be undone! Deleting this workspace will cascaded delete all tasks, meetings, logs, chats, and invitations. Are you absolutely sure you want to proceed?"
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      const res = await api.delete(`/workspaces/${currentWorkspace._id}`);
      if (res.success) {
        alert("Workspace deleted successfully.");
        // Refresh workspaces list
        const wRes = await api.get('/workspaces');
        if (wRes.success) {
          setWorkspaces(wRes.data);
          if (wRes.data.length > 0) {
            setCurrentWorkspace(wRes.data[0]);
          } else {
            setCurrentWorkspace(null);
          }
        }
        window.location.reload(); // force reload to sync views
      } else {
        alert(extractErrorMessage(res.error, 'Failed to delete workspace.'));
      }
    } catch (err) {
      alert("Server connection failed.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
        <div className="spinner" />
        Loading workspace telemetry...
      </div>
    );
  }

  const isAuthorized = userRole === 'Owner' || userRole === 'Admin';
  const isOwner = userRole === 'Owner';

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-400" />
          Workspace Settings
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Configure active workspace details, customize fields, and review administrative controls.
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
        }`}>
          <Info className="h-4 w-4 shrink-0" />
          {message.text}
        </div>
      )}

      {/* Settings Panel */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 bg-slate-900/20">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Edit3 className="h-4 w-4 text-indigo-400" />
          General Workspace Details
        </h3>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Workspace Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAuthorized}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isAuthorized}
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          {isAuthorized ? (
            <button
              type="submit"
              disabled={updating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/20"
            >
              <Save className="h-4 w-4" />
              {updating ? 'Saving Changes...' : 'Save Changes'}
            </button>
          ) : (
            <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 text-xs flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-400" />
              Only Workspace Owners and Admins can update settings.
            </div>
          )}
        </form>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div className="glass-panel p-6 rounded-2xl border-rose-950/40 bg-rose-950/5">
          <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
            Danger Zone
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">
            Deleting this workspace is immediate and irreversible. All associated workspaces tasks, meeting records, audio recordings, chat logs, transcripts, and member records will be permanently deleted.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-lg hover:shadow-rose-500/20"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting Workspace...' : 'Delete Workspace'}
          </button>
        </div>
      )}
    </div>
  );
}
