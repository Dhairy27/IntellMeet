import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  phone: string;
  role: string;
  workspaces: string[];
}

interface Workspace {
  _id: string;
  name: string;
  description?: string;
  creator: any;
  members: any[];
}

interface Meeting {
  _id: string;
  title: string;
  host: any;
  workspace?: string;
  roomId: string;
  status: 'scheduled' | 'live' | 'ended';
  startTime?: string;
  endTime?: string;
  chatMessages: any[];
  transcript: any[];
  aiSummary: string;
  aiActionItems: any[];
  recordingUrl?: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  activeMeeting: Meeting | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isFetchingWorkspaces: boolean;
  
  login: (user: User, token: string) => void;
  logout: () => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setActiveMeeting: (meeting: Meeting | null) => void;
  setLoading: (loading: boolean) => void;
  setFetchingWorkspaces: (fetching: boolean) => void;
  setUser: (user: User) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  workspaces: [],
  currentWorkspace: null,
  activeMeeting: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  isFetchingWorkspaces: false,

  login: (user, token) => {
    // Store token under the key 'token' — this must match what api.ts reads
    localStorage.setItem('token', token);
    // Clean up any stale key from a previous version (e.g., 'accessToken')
    localStorage.removeItem('accessToken');
    // Debug: confirm token was saved
    console.log('[store] login — token saved to localStorage:', token ? `${token.substring(0, 20)}...` : 'MISSING!');
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken'); // clean up old key too
    localStorage.removeItem('currentView');
    localStorage.removeItem('activeRoomId');
    localStorage.removeItem('selectedMeetingId');
    localStorage.removeItem('inLobby');
    console.log('[store] logout — all tokens cleared from localStorage');
    set({ user: null, token: null, isAuthenticated: false, workspaces: [], currentWorkspace: null, activeMeeting: null });
  },

  setWorkspaces: (workspaces) => {
    set({ workspaces });
    if (workspaces.length > 0) {
      set((state) => {
        const cachedId = localStorage.getItem('currentWorkspaceId');
        const cachedWorkspace = cachedId ? workspaces.find(w => w._id === cachedId) : null;
        
        if (cachedWorkspace) {
          return { currentWorkspace: cachedWorkspace };
        }
        
        if (!state.currentWorkspace || !workspaces.some(w => w._id === state.currentWorkspace?._id)) {
          return { currentWorkspace: workspaces[0] };
        }
        return {};
      });
    }
  },

  setCurrentWorkspace: (currentWorkspace) => {
    if (currentWorkspace) {
      localStorage.setItem('currentWorkspaceId', currentWorkspace._id);
    } else {
      localStorage.removeItem('currentWorkspaceId');
    }
    set({ currentWorkspace });
  },
  setActiveMeeting: (activeMeeting) => set({ activeMeeting }),
  setLoading: (isLoading) => set({ isLoading }),
  setFetchingWorkspaces: (isFetchingWorkspaces) => set({ isFetchingWorkspaces }),
  setUser: (user) => set({ user, isAuthenticated: true }),
}));
