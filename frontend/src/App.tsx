declare global {
  interface Window {
    google: any;
  }
}

import React, { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { api } from './api';
import { extractErrorMessage } from './utils/extractError';
import {
  LayoutDashboard,
  Video,
  KanbanSquare,
  BarChart3,
  LogOut,
  Plus,
  Briefcase,
  Bell,
  Sparkles,
  ShieldAlert,
  Menu,
  X,
  User,
  Users,
  Settings
} from 'lucide-react';

// Import Views
import Dashboard from './pages/Dashboard';
import MeetingRoom from './pages/MeetingRoom';
import PostMeeting from './pages/PostMeeting';
import KanbanBoard from './pages/KanbanBoard';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import WorkspaceSettings from './pages/WorkspaceSettings';
import MembersPage from './pages/MembersPage';

// Import Safety Components
import LoadingScreen from './components/LoadingScreen';

// Import Assets
import logoIcon from './assets/logo-icon.png';

export default function App() {
  const {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    workspaces,
    setWorkspaces,
    currentWorkspace,
    setCurrentWorkspace,
    setUser,
    isLoading,
    setLoading,
    isFetchingWorkspaces,
    setFetchingWorkspaces
  } = useAppStore();

  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>('login');
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'meeting' | 'post-meeting' | 'kanban' | 'analytics' | 'profile' | 'members' | 'settings'>(() => {
    return (localStorage.getItem('currentView') as any) || 'dashboard';
  });
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    return localStorage.getItem('activeRoomId');
  });
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(() => {
    return localStorage.getItem('selectedMeetingId');
  });
  const [isInitializing, setIsInitializing] = useState(true);
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    if (activeRoomId) {
      localStorage.setItem('activeRoomId', activeRoomId);
    } else {
      localStorage.removeItem('activeRoomId');
    }
  }, [activeRoomId]);

  useEffect(() => {
    if (selectedMeetingId) {
      localStorage.setItem('selectedMeetingId', selectedMeetingId);
    } else {
      localStorage.removeItem('selectedMeetingId');
    }
  }, [selectedMeetingId]);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // UI state
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Google login states
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);

  const hasInitializedRef = React.useRef(false);

  // Load user profile if token is present, or try silent refresh
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initAuth = async () => {
      let activeToken = token;

      // If we don't have an active token, try silent refresh via HTTP-only cookie first
      if (!activeToken) {
        try {
          const refreshRes = await api.post('/auth/refresh-token', {});
          if (refreshRes.success && refreshRes.data?.accessToken) {
            activeToken = refreshRes.data.accessToken;
            // Get user info and log in
            const meRes = await api.get('/auth/me');
            if (meRes.success) {
              const userData = meRes.data?.user || meRes.user;
              login(userData, activeToken!);
              const wRes = await api.get('/workspaces');
              if (wRes.success) {
                setWorkspaces(wRes.data);
              }
              setIsInitializing(false);
              return;
            }
          }
        } catch (refreshErr) {
          console.warn('Initial silent token refresh failed:', refreshErr);
        }
      }

      if (activeToken) {
        try {
          setFetchingWorkspaces(true);
          const res = await api.get('/auth/me');
          if (res.success) {
            setUser(res.data?.user || res.user);
            // Fetch workspaces
            const wRes = await api.get('/workspaces');
            if (wRes.success) {
              setWorkspaces(wRes.data);
            }
          } else {
            logout();
          }
        } catch (e) {
          console.error('Auth verification failed', e);
          logout();
        } finally {
          setFetchingWorkspaces(false);
        }
      }
      setIsInitializing(false);
    };
    initAuth();
  }, [token]);

  // Handle workspace invitation acceptance
  useEffect(() => {
    if (isInitializing) return;

    const queryParams = new URLSearchParams(window.location.search);
    const urlToken = queryParams.get('inviteToken');
    
    if (urlToken) {
      localStorage.setItem('pendingInviteToken', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const processInvitation = async () => {
      const storedToken = localStorage.getItem('pendingInviteToken');
      if (!storedToken) return;

      if (!isAuthenticated) {
        setErrorMsg('Please log in or sign up to accept the workspace invitation.');
        setShowAuthForm(true);
        setAuthView('login');
        return;
      }

      try {
        setLoading(true);
        console.log('[App] Attempting to accept workspace invitation...');
        const res = await api.post('/workspaces/invitations/accept', { token: storedToken });
        
        if (res.success) {
          localStorage.removeItem('pendingInviteToken');
          alert('Successfully joined the new workspace!');
          
          setFetchingWorkspaces(true);
          const wRes = await api.get('/workspaces');
          if (wRes.success && Array.isArray(wRes.data)) {
            const previousWorkspaceIds = workspaces.map((w: any) => w._id);
            setWorkspaces(wRes.data);
            
            const newWorkspace = wRes.data.find((w: any) => !previousWorkspaceIds.includes(w._id));
            if (newWorkspace) {
              setCurrentWorkspace(newWorkspace);
            } else if (wRes.data.length > 0) {
              setCurrentWorkspace(wRes.data[wRes.data.length - 1]);
            }
          }
          setCurrentView('dashboard');
        } else {
          const errMsg = extractErrorMessage(res.error, 'Failed to accept invitation');
          alert(errMsg);
          localStorage.removeItem('pendingInviteToken');
        }
      } catch (err) {
        console.error('Failed to accept workspace invite', err);
      } finally {
        setLoading(false);
        setFetchingWorkspaces(false);
      }
    };

    processInvitation();
  }, [isInitializing, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) return setErrorMsg('All fields are required');

    try {
      setLoading(true);
      const res = await api.post('/auth/login', { email, password });
      // Debug: log the full response to see what the backend sent
      console.log('[App] Login response:', { success: res.success, hasToken: !!res.token, user: res.user });

      if (res.success) {
        const userData = res.data?.user || res.user;
        const userToken = res.data?.accessToken || res.data?.token || res.token;
        login(userData, userToken);
        // Load workspaces
        setFetchingWorkspaces(true);
        const wRes = await api.get('/workspaces');
        if (wRes.success) {
          setWorkspaces(wRes.data);
        }
        setFetchingWorkspaces(false);
        setCurrentView('dashboard');
      } else {
        setErrorMsg(extractErrorMessage(res.error, 'Invalid credentials'));
      }
    } catch (err: any) {
      setErrorMsg('Server connection failed. Make sure server is running.');
    } finally {
      setLoading(false);
      setFetchingWorkspaces(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name || !email || !password) return setErrorMsg('All fields are required');

    try {
      setLoading(true);
      const firstName = name.trim().split(/\s+/)[0];
      const res = await api.post('/auth/register', { name, email, password, firstName });
      if (res.success) {
        const userData = res.data?.user || res.user;
        const userToken = res.data?.accessToken || res.data?.token || res.token;
        const defaultWs = res.data?.workspace;

        login(userData, userToken);
        if (defaultWs) {
          setCurrentWorkspace(defaultWs);
        }

        // Load workspaces
        setFetchingWorkspaces(true);
        const wRes = await api.get('/workspaces');
        if (wRes.success) {
          setWorkspaces(wRes.data);
          const matchedWs = wRes.data.find((w: any) => w._id === defaultWs?._id);
          if (matchedWs) {
            setCurrentWorkspace(matchedWs);
          }
        }
        setFetchingWorkspaces(false);
        setCurrentView('dashboard');
      } else {
        setErrorMsg(extractErrorMessage(res.error, 'Registration failed'));
      }
    } catch (err: any) {
      setErrorMsg('Server connection failed.');
    } finally {
      setLoading(false);
      setFetchingWorkspaces(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!email) return setErrorMsg('Please enter your email address');

    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.success) {
        const otpVal = res.resetOTP || '';
        setSuccessMsg('A 6-digit OTP code has been sent to your email address. Please check your inbox.');
        console.log('Reset Password OTP (developer testing only):', otpVal);
        setOtpCode(''); // Do not prefill OTP in UI
        // Transition to reset password view
        setAuthView('reset-password');
      } else {
        setErrorMsg(extractErrorMessage(res.error, 'Failed to request OTP'));
      }
    } catch (err) {
      setErrorMsg('Server connection failed.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!otpCode || !newPassword) return setErrorMsg('All fields are required');
    if (otpCode.length !== 6 || isNaN(Number(otpCode))) return setErrorMsg('OTP must be a 6-digit number');
    if (newPassword.length < 6) return setErrorMsg('Password must be at least 6 characters');

    try {
      setLoading(true);
      const res = await api.put(`/auth/reset-password/${otpCode}`, { password: newPassword });
      if (res.success) {
        setSuccessMsg('Password reset successful! Logging you in...');
        setTimeout(async () => {
          const userData = res.data?.user || res.user;
          const userToken = res.data?.accessToken || res.data?.token || res.token;
          login(userData, userToken);
          // Load workspaces safely
          setFetchingWorkspaces(true);
          try {
            const wRes = await api.get('/workspaces');
            if (wRes.success) {
              setWorkspaces(wRes.data);
            }
          } catch (wsErr) {
            console.error('Failed to load workspaces after password reset', wsErr);
          } finally {
            setFetchingWorkspaces(false);
          }
          setCurrentView('dashboard');
          setAuthView('login');
          setOtpCode('');
          setNewPassword('');
          setSuccessMsg('');
        }, 1500);
      } else {
        setErrorMsg(extractErrorMessage(res.error, 'Failed to reset password'));
      }
    } catch (err) {
      setErrorMsg('Server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Google client settings from backend config on mount
  useEffect(() => {
    const fetchGoogleConfig = async () => {
      try {
        const res = await api.get('/auth/google/config');
        if (res.success && res.data?.clientId) {
          setGoogleClientId(res.data.clientId);
        }
      } catch (err) {
        console.error('Failed to load Google Client Config', err);
      }
    };
    fetchGoogleConfig();
  }, []);

  // Check for redirect OAuth2 callback tokens on mount
  useEffect(() => {
    const checkRedirectHash = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('id_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        if (idToken) {
          // Clean hash to keep the URL clean
          window.history.replaceState(null, '', window.location.pathname);
          setIsVerifyingGoogle(true);
          handleGoogleVerify(idToken);
        }
      }
    };
    checkRedirectHash();
  }, [googleClientId]);

  // GSI Initialization has been modularized into the GoogleLoginButton component below

  const handleGoogleVerify = async (credentialToken: string) => {
    setErrorMsg('');
    try {
      setLoading(true);
      const res = await api.post('/auth/google', {
        credential: credentialToken
      });

      if (res.success) {
        const userData = res.data?.user || res.user;
        const userToken = res.data?.accessToken || res.data?.token || res.token;
        login(userData, userToken);
        // Load workspaces
        setFetchingWorkspaces(true);
        const wRes = await api.get('/workspaces');
        if (wRes.success) {
          setWorkspaces(wRes.data);
        }
        setFetchingWorkspaces(false);
        setCurrentView('dashboard');
        setShowAuthForm(false);
      } else {
        setErrorMsg(extractErrorMessage(res.error, 'Google token validation failed'));
        setAuthView('login');
        setShowAuthForm(true);
      }
    } catch (err) {
      setErrorMsg('Server connection failed.');
      setAuthView('login');
      setShowAuthForm(true);
    } finally {
      setLoading(false);
      setFetchingWorkspaces(false);
      setIsVerifyingGoogle(false);
    }
  };

  const handleCustomGoogleLogin = () => {
    setErrorMsg('');
    const redirectUri = window.location.origin;
    const nonce = Math.random().toString(36).substring(2);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20profile%20email&nonce=${nonce}&prompt=select_account`;

    // Redirect current window directly to bypass browser pop-up blocks completely
    window.location.href = authUrl;
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      const res = await api.post('/workspaces', {
        name: newWorkspaceName,
        description: newWorkspaceDesc,
      });

      if (res.success) {
        // Refresh workspaces list
        const wRes = await api.get('/workspaces');
        if (wRes.success) {
          setWorkspaces(wRes.data);
          // Set as active
          const created = wRes.data.find((w: any) => w._id === res.data._id);
          if (created) setCurrentWorkspace(created);
        }
        setNewWorkspaceName('');
        setNewWorkspaceDesc('');
        setShowWorkspaceModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmNavigation = (action: () => void) => {
    const isMeetingLive = currentView === 'meeting' && activeRoomId;
    if (isMeetingLive) {
      const confirmLeave = window.confirm("You are currently in a meeting session. Leaving this page will exit or end the meeting. Are you sure you want to proceed?");
      if (!confirmLeave) return;

      const meetingHostId = localStorage.getItem('meetingHostId');
      const isHost = meetingHostId === user?.id;

      if (isHost && activeRoomId) {
        // If the user is the host, call endpoint to end the meeting for all
        api.put(`/meetings/${activeRoomId}/end`, {}).catch((err) => {
          console.error("Failed to end meeting on navigation", err);
        });
      }

      // Reset meeting room/lobby states
      setActiveRoomId(null);
      localStorage.removeItem('inLobby');
      localStorage.removeItem('meetingHostId');
    }
    action();
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      console.error('[App] Backend logout failed:', err);
    } finally {
      logout();
    }
  };

  const navigateToMeeting = (roomId: string) => {
    setActiveRoomId(roomId);
    setCurrentView('meeting');
  };

  const navigateToPostMeeting = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    setCurrentView('post-meeting');
  };

  if (isInitializing) {
    return <LoadingScreen message="Loading IntellMeet Workspace..." />;
  }

  if (isVerifyingGoogle) {
    return <LoadingScreen message="Verifying Google credentials..." />;
  }

  if (isAuthenticated && isFetchingWorkspaces) {
    return <LoadingScreen message="Syncing workspaces with database..." />;
  }

  if (isAuthenticated && isLoading) {
    return <LoadingScreen message="Updating account states..." />;
  }

  // Not authenticated view (Login / Register / Details Landing)
  if (!isAuthenticated) {
    if (!showAuthForm) {
      return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
          {/* Header/Navbar */}
          <header className="w-full max-w-7xl mx-auto h-20 px-6 flex items-center justify-between border-b border-slate-800/40 relative z-20">
            <div className="flex items-center gap-3">
              <img src={logoIcon} alt="IntellMeet Logo" className="h-9 w-9 object-contain" />
              <span className="font-extrabold text-xl logo-gradient-text bg-clip-text text-transparent tracking-tight">
                IntellMeet
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setAuthView('login'); setShowAuthForm(true); }}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer font-sans"
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthView('register'); setShowAuthForm(true); }}
                className="px-4 py-2 text-xs font-bold bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg transition-all shadow-md cursor-pointer hover:translate-y-[-1px] font-sans"
              >
                Get Started
              </button>
            </div>
          </header>

          {/* Hero Section */}
          <main className="flex-1 flex flex-col relative z-10 max-w-5xl mx-auto px-6 py-16 text-center justify-center items-center gap-8">
            {/* Glowing background circles */}
            <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full blur-[140px] pointer-events-none opacity-20" style={{ backgroundColor: 'var(--glow-indigo)' }} />
            <div className="absolute bottom-[20%] right-[10%] w-[35%] h-[35%] rounded-full blur-[130px] pointer-events-none opacity-20" style={{ backgroundColor: 'var(--glow-emerald)' }} />

            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">
              <Sparkles className="h-3 w-3" />
              AI-Powered Enterprise Collaboration
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] max-w-3xl">
              Next-Generation Collaboration,{' '}
              <span className="logo-gradient-text bg-clip-text text-transparent">
                Supercharged by AI
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-400 max-w-2xl leading-relaxed font-sans">
              IntellMeet bridges the gap between video conferencing, real-time cooperative task tracking, and advanced AI-generated workspaces. Bring your team together and let intelligence capture what matters.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-2 justify-center items-center">
              <button
                onClick={() => { setAuthView('register'); setShowAuthForm(true); }}
                className="w-full sm:w-auto px-8 py-3 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-xl shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all hover:translate-y-[-1px] cursor-pointer font-sans"
              >
                Start Collaborating Free
              </button>
              <button
                onClick={() => { setAuthView('login'); setShowAuthForm(true); }}
                className="w-full sm:w-auto px-8 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer font-sans"
              >
                Sign In with Workspace
              </button>
            </div>

            {/* Features Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full text-left">
              <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300 hover:translate-y-[-2px]">
                <div>
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 w-fit mb-4">
                    <Video className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 font-sans">HD Meeting Rooms</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal font-sans">
                    Collaborate instantly with reliable audio and video channels, live chat, multi-author notepad, and animated speaker speech waveform visualizers.
                  </p>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300 hover:translate-y-[-2px]">
                <div>
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 w-fit mb-4">
                    <KanbanSquare className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 font-sans">Integrated Tasks</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal font-sans">
                    Assign, schedule, and drag tasks across customizable Kanban board status lanes. Synchronize deliverables and action items directly in real time.
                  </p>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300 hover:translate-y-[-2px]">
                <div>
                  <div className="p-2.5 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20 w-fit mb-4">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 font-sans">AI Summary Analytics</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal font-sans">
                    Receive bulleted summaries, action logs, and owner task recommendations automatically when a call ends. Convert items to tasks with a single click.
                  </p>
                </div>
              </div>
            </div>

            {/* Telemetry section */}
            <div className="w-full border-t border-slate-800/60 pt-10 mt-10 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-100 font-mono">1.3s</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1 font-sans">Setup Speed</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-100 font-mono">86%</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1 font-sans">Productivity Index</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-100 font-mono">100%</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1 font-sans">Data Privacy</p>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="w-full text-center py-6 border-t border-slate-800/40 text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-12 z-20 font-sans">
            © 2026 IntellMeet Collaboration. All rights reserved.
          </footer>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">

        {/* Background gradients */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[120px]" style={{ backgroundColor: 'var(--glow-indigo)' }} />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full blur-[120px]" style={{ backgroundColor: 'var(--glow-emerald)' }} />

        <div className="w-full max-w-md relative">
          <button
            onClick={() => { setShowAuthForm(false); setErrorMsg(''); setSuccessMsg(''); }}
            className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-slate-200 text-slate-400 text-xs font-semibold rounded-lg transition-all cursor-pointer font-sans"
          >
            ← Back to Home
          </button>

          <div className="w-full glass-panel p-8 rounded-2xl shadow-2xl relative border-slate-800">
            <div className="text-center mb-8">
              <img src={logoIcon} alt="IntellMeet Logo" className="h-14 w-14 object-contain mx-auto mb-4" />
              <h1 className="text-3xl font-extrabold tracking-tight logo-gradient-text bg-clip-text text-transparent">
                IntellMeet
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                AI-Powered Enterprise Collaboration Platform
              </p>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-rose-300 text-xs mb-6">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg text-emerald-300 text-xs mb-6">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {authView === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setAuthView('forgot-password'); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-xs text-indigo-400 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg hover:shadow-indigo-500/20 hover:translate-y-[-1px] active:translate-y-0 cursor-pointer"
                >
                  Sign In
                </button>

                {googleClientId && (
                  <>
                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-800/80"></div>
                      <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase font-semibold">Or</span>
                      <div className="flex-grow border-t border-slate-800/80"></div>
                    </div>

                    <div className="w-full flex flex-col items-center gap-2 pt-1 pb-1">
                      <button
                        type="button"
                        onClick={handleCustomGoogleLogin}
                        className="w-full max-w-[384px] flex justify-center items-center gap-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-lg py-2.5 px-4 text-sm font-semibold text-slate-200 transition-all duration-300 cursor-pointer shadow-lg hover:scale-[1.01]"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign In with Google
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {authView === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg hover:shadow-indigo-500/20 hover:translate-y-[-1px] active:translate-y-0 cursor-pointer"
                >
                  Create Account
                </button>
              </form>
            )}

            {authView === 'forgot-password' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  Enter your email address and we will send a 6-digit OTP code to your email.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg hover:shadow-indigo-500/20 hover:translate-y-[-1px] active:translate-y-0 cursor-pointer"
                >
                  Send OTP Code
                </button>
              </form>
            )}

            {authView === 'reset-password' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  Enter the 6-digit OTP sent to your email and choose a new password.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">6-Digit OTP</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="e.g. 123456"
                    required
                    maxLength={6}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono text-center tracking-widest text-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg hover:shadow-indigo-500/20 hover:translate-y-[-1px] active:translate-y-0 cursor-pointer"
                >
                  Reset Password
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-xs text-slate-400">
              {authView === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button onClick={() => { setAuthView('register'); setErrorMsg(''); }} className="text-indigo-400 hover:underline font-semibold cursor-pointer">
                    Sign Up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button onClick={() => { setAuthView('login'); setErrorMsg(''); }} className="text-indigo-400 hover:underline font-semibold cursor-pointer">
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    );
  }

  // Authenticated View
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar - Desktop */}
      <aside className={`w-64 shrink-0 bg-slate-900/80 border-r border-slate-800/60 flex-col h-screen sticky top-0 ${currentView === 'meeting' && activeRoomId ? 'hidden' : 'hidden md:flex'}`}>
        {/* Brand */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/60">
          <img src={logoIcon} alt="IntellMeet Logo" className="h-9 w-9 object-contain" />
          <span className="font-bold text-lg sidebar-logo-text bg-clip-text text-transparent">
            IntellMeet
          </span>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-semibold border border-indigo-500/20">
            v2.0
          </span>
        </div>

        {/* Workspace Selector */}
        <div className="p-4 border-b border-slate-800/40">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Active Workspace
          </label>
          <div className="flex gap-2 items-center">
            <select
              value={currentWorkspace?._id || ''}
              onChange={(e) => {
                const ws = (workspaces || []).find(w => w?._id === e.target.value);
                if (ws) {
                  confirmNavigation(() => setCurrentWorkspace(ws));
                }
              }}
              className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {(workspaces || []).map((w) => (
                <option key={w?._id || ''} value={w?._id || ''}>
                  {w?.name || 'Untitled Workspace'}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowWorkspaceModal(true)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 cursor-pointer"
              title="New Workspace"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            onClick={() => confirmNavigation(() => { setCurrentView('dashboard'); setMobileMenuOpen(false); })}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentView === 'dashboard' || currentView === 'post-meeting'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5" />
            Dashboard
          </button>

          <button
            onClick={() => confirmNavigation(() => { setCurrentView('kanban'); setMobileMenuOpen(false); })}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentView === 'kanban'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
          >
            <KanbanSquare className="h-4.5 w-4.5" />
            Tasks Board
          </button>

          <button
            onClick={() => confirmNavigation(() => { setCurrentView('meeting'); setActiveRoomId(null); setMobileMenuOpen(false); })}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentView === 'meeting'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
          >
            <Video className="h-4.5 w-4.5" />
            Meeting Room
          </button>

          <button
            onClick={() => confirmNavigation(() => { setCurrentView('analytics'); setMobileMenuOpen(false); })}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentView === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
          >
            <BarChart3 className="h-4.5 w-4.5" />
            Analytics & Insights
          </button>

          <button
            onClick={() => confirmNavigation(() => { setCurrentView('members'); setMobileMenuOpen(false); })}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentView === 'members'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
          >
            <Users className="h-4.5 w-4.5" />
            Workspace Members
          </button>

          <button
            onClick={() => confirmNavigation(() => { setCurrentView('settings'); setMobileMenuOpen(false); })}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentView === 'settings'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
          >
            <Settings className="h-4.5 w-4.5" />
            Workspace Settings
          </button>
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center gap-3 mb-3">
            {user?.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) ? (
              <img
                src={user.avatar}
                alt={user.name || 'User'}
                className="h-9 w-9 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div
                style={{ backgroundColor: user?.avatar || '#6366f1' }}
                className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm text-white border border-white/10"
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || ''}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => confirmNavigation(() => { setCurrentView('profile'); })}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20 text-slate-400 text-xs rounded-lg transition-colors cursor-pointer"
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </button>
            <button
              onClick={() => confirmNavigation(handleLogout)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-400 text-xs rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 px-4 md:px-8 border-b border-slate-800/40 bg-slate-900/30 flex items-center justify-between sticky top-0 z-30 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-1 text-slate-400 hover:text-white cursor-pointer ${currentView === 'meeting' && activeRoomId ? 'block' : 'md:hidden'}`}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-sm font-semibold text-slate-200 hidden md:block">
              {currentWorkspace ? `${currentWorkspace.name}` : 'Select Workspace'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/50 cursor-pointer relative transition-colors">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-indigo-500 rounded-full" />
            </button>
            <div className="h-5 w-[1px] bg-slate-800/80" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">{user?.role}</span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        <div
          className={`fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${currentView === 'meeting' && activeRoomId ? '' : 'md:hidden'} ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className={`w-64 bg-slate-900 h-full flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <img src={logoIcon} alt="IntellMeet Logo" className="h-8 w-8 object-contain" />
                <span className="font-bold">IntellMeet</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-800">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Workspace</label>
              <select
                value={currentWorkspace?._id || ''}
                onChange={(e) => {
                  const ws = (workspaces || []).find(w => w?._id === e.target.value);
                  if (ws) {
                    confirmNavigation(() => setCurrentWorkspace(ws));
                  }
                }}
                className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-xs focus:outline-none"
              >
                {(workspaces || []).map((w) => (
                  <option key={w?._id || ''} value={w?._id || ''}>{w?.name || 'Untitled Workspace'}</option>
                ))}
              </select>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              <button
                onClick={() => confirmNavigation(() => { setCurrentView('dashboard'); setMobileMenuOpen(false); })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${currentView === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                <LayoutDashboard className="h-4.5 w-4.5" />
                Dashboard
              </button>
              <button
                onClick={() => confirmNavigation(() => { setCurrentView('kanban'); setMobileMenuOpen(false); })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${currentView === 'kanban' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                <KanbanSquare className="h-4.5 w-4.5" />
                Tasks Board
              </button>
              <button
                onClick={() => confirmNavigation(() => { setCurrentView('meeting'); setActiveRoomId(null); setMobileMenuOpen(false); })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${currentView === 'meeting' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                <Video className="h-4.5 w-4.5" />
                Meeting Room
              </button>
              <button
                onClick={() => confirmNavigation(() => { setCurrentView('analytics'); setMobileMenuOpen(false); })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${currentView === 'analytics' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                <BarChart3 className="h-4.5 w-4.5" />
                Analytics
              </button>
              <button
                onClick={() => confirmNavigation(() => { setCurrentView('members'); setMobileMenuOpen(false); })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${currentView === 'members' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                <Users className="h-4.5 w-4.5" />
                Workspace Members
              </button>
              <button
                onClick={() => confirmNavigation(() => { setCurrentView('settings'); setMobileMenuOpen(false); })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${currentView === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                <Settings className="h-4.5 w-4.5" />
                Workspace Settings
              </button>
            </nav>
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex gap-2">
              <button
                onClick={() => confirmNavigation(() => { setCurrentView('profile'); setMobileMenuOpen(false); })}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20 text-slate-400 text-xs rounded-lg transition-colors cursor-pointer"
              >
                <User className="h-4 w-4" /> Profile
              </button>
              <button
                onClick={() => confirmNavigation(handleLogout)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-400 text-xs rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Viewport Rendering */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {currentView === 'dashboard' && (
            <Dashboard
              navigateToMeeting={navigateToMeeting}
              navigateToPostMeeting={navigateToPostMeeting}
            />
          )}

          {currentView === 'meeting' && (
            <MeetingRoom
              roomId={activeRoomId}
              onMeetingEnded={(meetingId) => {
                setActiveRoomId(null);
                localStorage.removeItem('inLobby');
                navigateToPostMeeting(meetingId);
              }}
              onLeave={() => {
                setActiveRoomId(null);
                localStorage.removeItem('inLobby');
                setCurrentView('dashboard');
              }}
            />
          )}

          {currentView === 'post-meeting' && (
            <PostMeeting
              meetingId={selectedMeetingId}
              onBack={() => setCurrentView('dashboard')}
            />
          )}

          {currentView === 'kanban' && (
            <KanbanBoard />
          )}

          {currentView === 'analytics' && (
            <Analytics />
          )}

          {currentView === 'members' && (
            <MembersPage />
          )}

          {currentView === 'settings' && (
            <WorkspaceSettings />
          )}

          {currentView === 'profile' && (
            <Profile onBack={() => setCurrentView('dashboard')} />
          )}
        </main>
      </div>

      {/* Workspace Creation Modal */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel rounded-xl shadow-2xl overflow-hidden border-slate-800">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-indigo-400" />
                Create New Workspace
              </h3>
              <button
                onClick={() => setShowWorkspaceModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Workspace Name</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. Core Engineering Team"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={newWorkspaceDesc}
                  onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                  placeholder="Describe the scope or team of this workspace..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


