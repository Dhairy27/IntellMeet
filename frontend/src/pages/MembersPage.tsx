import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { extractErrorMessage } from '../utils/extractError';
import { Users, UserPlus, Trash2, Shield, X, Check, Mail } from 'lucide-react';

export default function MembersPage() {
  const { currentWorkspace, user } = useAppStore();
  
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('Member');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchMembers = async () => {
    if (!currentWorkspace) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/workspaces/${currentWorkspace._id}/members`);
      if (res && res.success && Array.isArray(res.data)) {
        setMembers(res.data);
      }
      
      // Fetch details to get userRole
      const detRes = await api.get(`/workspaces/${currentWorkspace._id}`);
      if (detRes && detRes.success && detRes.data?.workspace) {
        setUserRole(detRes.data.workspace.userRole || 'Member');
      }
    } catch (err) {
      console.error('Failed to load workspace members', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [currentWorkspace]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !inviteEmail.trim()) return;
    try {
      setInviteLoading(true);
      setMessage({ type: '', text: '' });
      setInviteToken('');
      const res = await api.post(`/workspaces/${currentWorkspace._id}/invite`, { email: inviteEmail });
      
      if (res.success) {
        setMessage({ type: 'success', text: `Invitation sent successfully to ${inviteEmail}!` });
        if (res.data?.token) {
          setInviteToken(res.data.token);
        }
        setInviteEmail('');
      } else {
        setMessage({ type: 'error', text: extractErrorMessage(res.error, 'Failed to send invitation') });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server connection failed.' });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    if (!currentWorkspace) return;
    try {
      const res = await api.put(`/workspaces/${currentWorkspace._id}/members/${targetUserId}`, { role: newRole });
      if (res.success) {
        alert(extractErrorMessage(res.message, 'Role updated successfully!'));
        fetchMembers(); // refresh
      } else {
        alert(extractErrorMessage(res.error, 'Failed to change role'));
      }
    } catch (err) {
      alert('Server connection failed.');
    }
  };

  const handleKick = async (targetUserId: string) => {
    if (!currentWorkspace) return;
    const isSelf = targetUserId === user?.id;
    const confirmKick = window.confirm(
      isSelf 
        ? "Are you sure you want to leave this workspace?" 
        : "Are you sure you want to remove this member from the workspace?"
    );
    if (!confirmKick) return;

    try {
      const res = await api.delete(`/workspaces/${currentWorkspace._id}/members/${targetUserId}`);
      if (res.success) {
        alert(extractErrorMessage(res.message, 'Member removed successfully!'));
        if (isSelf) {
          window.location.reload(); // reload to re-route to standard default workspace
        } else {
          fetchMembers();
        }
      } else {
        alert(extractErrorMessage(res.error, 'Failed to remove member'));
      }
    } catch (err) {
      alert('Server connection failed.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
        <div className="spinner" />
        Compiling workspace roster...
      </div>
    );
  }

  const isAuthorized = userRole === 'Owner' || userRole === 'Admin';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-400" />
            Workspace Members
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Review workspace participant directories, invite collaborators, and adjust permission roles.
          </p>
        </div>

        {isAuthorized && (
          <button
            onClick={() => { setShowInviteModal(true); setMessage({ type: '', text: '' }); setInviteToken(''); }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Invite Collaborator
          </button>
        )}
      </div>

      {/* Members Directory */}
      <div className="glass-panel rounded-2xl border-slate-800 bg-slate-900/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-900/20">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Workspace Members ({members.length})</h3>
        </div>

        <div className="divide-y divide-slate-800/60">
          {members.map((m) => {
            if (!m || !m.user) return null;
            const memberId = m.user?._id || m.user?.id || '';
            const isSelf = memberId === user?.id;
            const isTargetOwner = m.role === 'Owner';
            const isTargetAdmin = m.role === 'Admin';
            
            // Authorization rules for select dropdown
            let showRoleSelector = false;
            if (isAuthorized && !isTargetOwner && !isSelf) {
              if (userRole === 'Owner') {
                showRoleSelector = true;
              } else if (userRole === 'Admin' && !isTargetAdmin) {
                showRoleSelector = true;
              }
            }

            // Authorization rules for kick button
            let showKickButton = false;
            if (isSelf && !isTargetOwner) {
              showKickButton = true; // can always leave
            } else if (isAuthorized && !isTargetOwner && !isSelf) {
              if (userRole === 'Owner') {
                showKickButton = true;
              } else if (userRole === 'Admin' && !isTargetAdmin) {
                showKickButton = true;
              }
            }

            return (
              <div key={memberId} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap hover:bg-slate-900/10 transition-colors">
                <div className="flex items-center gap-3">
                  {m.user?.avatar && (m.user.avatar.startsWith('http') || m.user.avatar.startsWith('https')) ? (
                    <img src={m.user.avatar} alt={m.user.name || 'User'} className="h-10 w-10 rounded-full object-cover border border-white/5" />
                  ) : (
                    <div style={{ backgroundColor: m.user?.avatar || '#6366f1' }} className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-white border border-white/5">
                      {m.user?.name ? m.user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-200">{m.user?.name || 'Unknown User'}</p>
                      {isSelf && <span className="text-[9px] bg-slate-800 text-slate-300 px-1 rounded font-bold border border-slate-700">You</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{m.user?.email || ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-auto sm:ml-0">
                  {/* Role Selector or Badge */}
                  {showRoleSelector ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(memberId, e.target.value)}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      {userRole === 'Owner' && <option value="Owner">Owner (Transfer)</option>}
                      <option value="Admin">Admin</option>
                      <option value="Member">Member</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      isTargetOwner 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                        : isTargetAdmin 
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      <Shield className="h-3 w-3" />
                      {m.role}
                    </span>
                  )}

                  {/* Remove/Leave Button */}
                  {showKickButton && (
                    <button
                      onClick={() => handleKick(memberId)}
                      className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                        isSelf 
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20 hover:text-rose-300'
                      }`}
                      title={isSelf ? "Leave Workspace" : "Remove Member"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel rounded-xl shadow-2xl overflow-hidden border-slate-800">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-400" />
                Invite Workspace Member
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {message.text && (
                <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                }`}>
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{message.text}</span>
                </div>
              )}

              {inviteToken && (
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-xs space-y-2">
                  <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-indigo-400" />
                    Simulated Invite Token
                  </p>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-mono select-all break-all bg-slate-900 p-2 rounded border border-slate-800">
                    {inviteToken}
                  </p>
                  <p className="text-[9px] text-slate-500 italic">
                    Use this token in post-invitations flow accept/reject tests.
                  </p>
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="collaborator@company.com"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white text-xs font-medium rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    {inviteLoading ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
