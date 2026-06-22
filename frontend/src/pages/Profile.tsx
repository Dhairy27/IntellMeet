import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { extractErrorMessage } from '../utils/extractError';
import { useAppStore } from '../store';
import {
  User as UserIcon,
  Mail,
  Phone,
  FileText,
  Palette,
  Lock,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Camera,
  Upload,
  Briefcase
} from 'lucide-react';

interface ProfileProps {
  onBack: () => void;
}

export default function Profile({ onBack }: ProfileProps) {
  const { user, setUser, workspaces } = useAppStore();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');

  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const presetColors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#2563eb', '#0ea5e9', '#64748b',
  ];

  const isImageUrl = (str: string) => {
    return str && (str.startsWith('http://') || str.startsWith('https://'));
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/profile');
        if (res.success) {
          setName(res.data.name || '');
          setBio(res.data.bio || '');
          setPhone(res.data.phone || '');
          setAvatar(res.data.avatar || '');
        } else {
          setProfileMsg({ type: 'error', text: extractErrorMessage(res.error, 'Failed to load profile') });
        }
      } catch (err) {
        console.error('[Profile] Failed to fetch profile:', err);
        setProfileMsg({ type: 'error', text: 'Could not connect to server' });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'error', text: 'Please select an image file (JPG, PNG, etc.)' });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setUploading(true);
    setProfileMsg(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.putFormData('/profile/avatar', formData);

      if (res.success) {
        setAvatar(res.data.avatar);
        setAvatarPreview(null);
        setProfileMsg({ type: 'success', text: 'Avatar uploaded successfully!' });

        setUser({
          id: res.data._id,
          name: res.data.name,
          email: res.data.email,
          avatar: res.data.avatar || '',
          bio: res.data.bio || '',
          phone: res.data.phone || '',
          role: res.data.role,
          workspaces: res.data.workspaces || [],
        });
      } else {
        setProfileMsg({ type: 'error', text: extractErrorMessage(res.error, 'Avatar upload failed') });
        setAvatarPreview(null);
      }
    } catch (err) {
      console.error('[Profile] Avatar upload error:', err);
      setProfileMsg({ type: 'error', text: 'Failed to upload avatar' });
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSaving(true);

    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'Name is required' });
      setSaving(false);
      return;
    }

    try {
      const res = await api.put('/profile', { name, bio, phone, avatar });
      if (res.success) {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        setUser({
          id: res.data._id,
          name: res.data.name,
          email: res.data.email,
          avatar: res.data.avatar || '',
          bio: res.data.bio || '',
          phone: res.data.phone || '',
          role: res.data.role,
          workspaces: res.data.workspaces || [],
        });
      } else {
        setProfileMsg({ type: 'error', text: extractErrorMessage(res.error, 'Update failed') });
      }
    } catch (err) {
      console.error('[Profile] Update error:', err);
      setProfileMsg({ type: 'error', text: 'Server connection failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setChangingPw(true);

    if (!currentPassword || !newPassword) {
      setPasswordMsg({ type: 'error', text: 'Both password fields are required' });
      setChangingPw(false);
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      setChangingPw(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      setChangingPw(false);
      return;
    }

    try {
      const res = await api.put('/profile/password', { currentPassword, newPassword });
      if (res.success) {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: extractErrorMessage(res.error, 'Password change failed') });
      }
    } catch (err) {
      console.error('[Profile] Password change error:', err);
      setPasswordMsg({ type: 'error', text: 'Server connection failed' });
    } finally {
      setChangingPw(false);
    }
  };

  useEffect(() => {
    if (profileMsg) {
      const timer = setTimeout(() => setProfileMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [profileMsg]);

  useEffect(() => {
    if (passwordMsg) {
      const timer = setTimeout(() => setPasswordMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [passwordMsg]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-slate-400 text-sm">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Profile Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage your personal information and security</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="glass-panel rounded-xl overflow-hidden border border-slate-800/60">
        <div className="relative h-28 bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-slate-900/50">
          <div className="absolute -bottom-10 left-6">
            <div className="relative group">
              {(avatarPreview || isImageUrl(avatar)) ? (
                <img
                  src={avatarPreview || avatar}
                  alt="Avatar"
                  className="h-20 w-20 rounded-2xl object-cover border-4 border-slate-900 shadow-xl"
                />
              ) : (
                <div
                  style={{ backgroundColor: avatar || '#6366f1' }}
                  className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white border-4 border-slate-900 shadow-xl"
                >
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          <div className="absolute bottom-3 right-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all cursor-pointer backdrop-blur-sm shadow"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="p-6 pt-14 space-y-5">
          {profileMsg && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-xs border ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-350'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-350'
              }`}
            >
              {profileMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <UserIcon className="h-3.5 w-3.5 text-indigo-400" />
              Full Name
            </label>
            <input
              type="text"
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <Mail className="h-3.5 w-3.5 text-indigo-400" />
              Email Address
            </label>
            <input
              type="email"
              id="profile-email"
              value={user?.email || ''}
              disabled
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              maxLength={300}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-[10px] text-slate-500 text-right">{bio.length}/300</p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <Phone className="h-3.5 w-3.5 text-indigo-400" />
              Phone Number
            </label>
            <input
              type="tel"
              id="profile-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <Palette className="h-3.5 w-3.5 text-indigo-400" />
              Avatar Color
              {isImageUrl(avatar) && (
                <span className="text-[10px] text-slate-500 font-normal normal-case ml-1">(overridden by uploaded photo)</span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatar(color)}
                  className={`h-8 w-8 rounded-lg border-2 transition-all cursor-pointer hover:scale-110 ${
                    avatar === color
                      ? 'border-white shadow-lg shadow-indigo-500/20 scale-110'
                      : 'border-transparent hover:border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            {isImageUrl(avatar) && (
              <p className="text-[10px] text-slate-500 mt-2">
                You have a photo uploaded. Pick a color to remove the photo and use a colored avatar instead.
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-all shadow-lg cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="glass-panel rounded-xl overflow-hidden border border-slate-800/60">
        <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-900/40">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-indigo-400" />
            Change Password
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Update your password to keep your account secure</p>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-5">
          {passwordMsg && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-xs border ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-350'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-350'
              }`}
            >
              {passwordMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                id="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 cursor-pointer"
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 cursor-pointer"
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changingPw}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-semibold text-sm rounded-lg transition-all border border-slate-700/50 cursor-pointer"
            >
              {changingPw ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {changingPw ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Associated Workspaces */}
      <div className="glass-panel rounded-2xl border border-slate-800/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-900/40">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-400" />
            Associated Workspaces
          </h3>
        </div>
        
        <div className="overflow-x-auto text-xs">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/20">
                <th className="px-6 py-3 font-semibold">Workspace Name</th>
                <th className="px-6 py-3 font-semibold">Description</th>
                <th className="px-6 py-3 font-semibold text-right">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-350">
              {workspaces.map((ws) => (
                <tr key={ws._id} className="hover:bg-slate-850/20 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-slate-200">{ws.name}</td>
                  <td className="px-6 py-3.5 text-slate-400">{ws.description || 'No description provided.'}</td>
                  <td className="px-6 py-3.5 text-right font-mono text-[10px] text-indigo-400 font-bold uppercase">Shared</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
