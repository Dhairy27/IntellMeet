import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import io from 'socket.io-client';
import NotePad from '../components/NotePad';
import { ROOM_CODE_REGEX } from '../constants/room';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  StopCircle,
  MessageSquare,
  FileText,
  Users,
  PhoneOff,
  Send,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  Maximize2,
  Minimize2,
  ArrowRight
} from 'lucide-react';

function VideoFeed({ stream, muted = false, className = '' }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.warn("Video play failed/blocked:", err);
      });
    }
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted={muted} className={className} />;
}

function AudioFeed({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(err => {
        console.warn("Audio play failed/blocked:", err);
      });
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />;
}

interface MeetingRoomProps {
  roomId: string | null;
  onMeetingEnded: (meetingId: string) => void;
  onLeave: () => void;
}

export default function MeetingRoom({ roomId, onMeetingEnded, onLeave }: MeetingRoomProps) {
  const { user, currentWorkspace } = useAppStore();
  const [meeting, setMeeting] = useState<any>(null);
  const [inLobby, setInLobby] = useState(() => {
    if (!roomId) return true;
    const saved = localStorage.getItem('inLobby');
    return saved === 'false' ? false : true;
  });
  const [roomCode, setRoomCode] = useState(roomId || '');

  // Room selection states
  const [hasSelectedRoom, setHasSelectedRoom] = useState(!!roomId);
  const [createTitle, setCreateTitle] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Media states
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [showSelfView, setShowSelfView] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Sidebar Panel State
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'notes' | 'transcript' | 'participants' | null>('chat');

  // Real-time states
  const [participants, setParticipants] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [sharedNotes, setSharedNotes] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<string>('You');

  // Media Ref hooks
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const socketRef = useRef<any>(null);
  const isFirstRender = useRef(true); // prevent videoEnabled effect firing on mount

  // Fullscreen State & Hooks
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // WebRTC multi-peer connection states
  const [remoteStreams, setRemoteStreams] = useState<{ [socketId: string]: MediaStream }>({});
  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});

  // Live bouncing bar waveform helper
  const ActiveWaveform = ({ isSpeaking }: { isSpeaking: boolean }) => {
    return (
      <div className="flex items-end gap-[2px] h-3 px-1.5 py-0.5 bg-slate-950/80 backdrop-blur-sm border border-slate-800/60 rounded">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            style={{
              animationDelay: `${bar * 0.15}s`,
              transformOrigin: 'bottom',
            }}
            className={`w-[2px] bg-emerald-400 rounded-full transition-all duration-300 ${isSpeaking ? 'animate-bounce-bar h-2.5' : 'h-1'
              }`}
          />
        ))}
      </div>
    );
  };

  // Join meeting after lobby check
  const handleJoin = async () => {
    const cleanCode = roomCode.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(cleanCode)) {
      alert("Please enter a valid 6-character meeting code.");
      return;
    }

    try {
      // Join meeting in DB (this handles both starting it if host and registering the participant)
      const res = await api.post(`/meetings/${cleanCode}/join`, {});
      if (res.success) {
        setMeeting(res.data.meeting);
        setInLobby(false);
      } else {
        alert(res.message || res.error?.message || res.error || 'Invalid meeting room code or failed to join.');
      }
    } catch (e) {
      console.error(e);
      alert('Could not join room.');
    }
  };

  const handleCreateInstantRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;
    if (!currentWorkspace?._id) {
      alert("No active workspace selected. Please select one in the sidebar.");
      return;
    }
    setIsCreating(true);
    try {
      const res = await api.post('/meetings', {
        title: createTitle.trim(),
        workspaceId: currentWorkspace._id,
        status: 'active'
      });
      if (res.success && res.data?.roomId) {
        setRoomCode(res.data.roomId);
        setMeeting(res.data);
        setHasSelectedRoom(true);
        setInLobby(true);
      } else {
        alert("Failed to create meeting room.");
      }
    } catch (err) {
      console.error(err);
      alert("Server error creating meeting.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(cleanCode)) {
      alert("Please enter a valid 6-character meeting code.");
      return;
    }
    setRoomCode(cleanCode);
    setHasSelectedRoom(true);
    setInLobby(true);
  };

  const handleCancelLobby = () => {
    if (roomId) {
      onLeave();
    } else {
      setHasSelectedRoom(false);
      setRoomCode('');
      setRoomCodeInput('');
      setMeeting(null);
    }
  };

  // Initialize audio stream for lobby/room preview (camera off by default)
  const startCamera = async (withVideo = false) => {
    try {
      setCameraError(null);

      // Stop existing tracks first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Give the OS 300ms to release the device before re-acquiring
      await new Promise(resolve => setTimeout(resolve, 300));

      const combinedStream = new MediaStream();

      if (withVideo) {
        // Request VIDEO independently so a blocked mic doesn't kill camera
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          videoStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
        } catch (videoErr: any) {
          let friendlyError = '';
          if (videoErr.name === 'NotReadableError' || videoErr.message?.includes('Could not start video source')) {
            friendlyError = 'Camera is in use by another app. Close Zoom, Teams, or other programs using the camera, then try again.';
          } else if (videoErr.name === 'NotAllowedError' || videoErr.name === 'PermissionDeniedError') {
            friendlyError = 'Camera access blocked. In Windows: Start → Settings → Privacy → Camera → turn on "Allow apps to access your camera". Then click Try Again.';
          } else {
            friendlyError = `Camera unavailable (${videoErr.name}). Check that no other app is using it.`;
          }
          setCameraError(friendlyError);
          // Don't return — still try to get audio below
        }
      }

      // Request AUDIO independently (separate call so video failure doesn't block mic)
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        audioStream.getAudioTracks().forEach(track => {
          track.enabled = audioEnabled;
          combinedStream.addTrack(track);
        });
      } catch (audioErr: any) {
        // Mic blocked — not fatal if we have video
        console.warn('Microphone access denied:', audioErr.name);
      }

      // Apply the combined stream (may have video only, audio only, both, or neither)
      if (combinedStream.getTracks().length > 0) {
        localStreamRef.current = combinedStream;
        setLocalStream(combinedStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = combinedStream;
        }
      } else {
        setLocalStream(null);
      }
    } catch (err) {
      console.warn('startCamera error:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('inLobby', String(inLobby));
  }, [inLobby]);

  useEffect(() => {
    if (meeting) {
      const hostId = meeting.host?._id || meeting.host;
      if (hostId) {
        localStorage.setItem('meetingHostId', hostId);
      }
    } else {
      localStorage.removeItem('meetingHostId');
    }
  }, [meeting]);

  useEffect(() => {
    const checkAutoRejoin = async () => {
      const savedInLobby = localStorage.getItem('inLobby');
      if (roomId && savedInLobby === 'false') {
        try {
          const res = await api.post(`/meetings/${roomId}/join`, {});
          if (res.success) {
            setMeeting(res.data.meeting);
            setInLobby(false);
          } else {
            setInLobby(true);
          }
        } catch (e) {
          console.error('Failed to auto rejoin meeting:', e);
          setInLobby(true);
        }
      } else if (!roomId) {
        setInLobby(true);
      }
    };
    checkAutoRejoin();
  }, [roomId]);

  useEffect(() => {
    if (inLobby) {
      // Start audio-only on mount (camera off by default)
      startCamera(false);
    }
  }, [inLobby]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Close all WebRTC peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      localStorage.removeItem('meetingHostId');
    };
  }, []);

  // Prevent accidental page refreshes / browser close when in meeting room/lobby
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Bind local stream to video element when stream or lobby state changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, inLobby, videoEnabled]);

  // Synchronize audio track status on user interaction
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = audioEnabled;
      });
    }
  }, [audioEnabled, localStream]);

  // Synchronize video track status on user interaction (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // don't run on mount — inLobby effect handles initial audio start
    }
    if (videoEnabled) {
      // User turned camera ON — restart stream with video
      startCamera(true);
    } else {
      // User turned camera OFF — stop video tracks, keep audio only
      if (localStream) {
        localStream.getVideoTracks().forEach(track => track.stop());
      }
      startCamera(false);
    }
  }, [videoEnabled]);

  // Update existing peer connections when local stream changes (e.g., toggled video/audio)
  useEffect(() => {
    if (!localStream) return;

    Object.values(peerConnectionsRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch((err) => {
            console.error(`Failed to replace track of kind ${track.kind}:`, err);
          });
        } else {
          try {
            pc.addTrack(track, localStream);
          } catch (err) {
            console.error(`Failed to add track of kind ${track.kind}:`, err);
          }
        }
      });
    });
  }, [localStream]);

  // WebRTC & Socket setup when joining active room
  useEffect(() => {
    if (inLobby || !meeting) return;

    // Connect to Socket.io
    const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
    const socket = io(socketUrl, { path: '/socket.io' });
    socketRef.current = socket;

    // Initialize WebRTC Peer Connection helper
    const createPeerConnection = (targetSocketId: string, isInitiator: boolean) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionsRef.current[targetSocketId] = pc;

      // Add local stream tracks to Peer Connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc-ice-candidate', {
            toSocketId: targetSocketId,
            candidate: event.candidate
          });
        }
      };

      // Handle remote track stream
      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({
          ...prev,
          [targetSocketId]: event.streams[0]
        }));
      };

      // If initiator, negotiate/send offer
      if (isInitiator) {
        pc.onnegotiationneeded = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit('webrtc-offer', {
              toSocketId: targetSocketId,
              offer
            });
          } catch (err) {
            console.error('Failed to create offer:', err);
          }
        };
      }

      return pc;
    };

    // Join room
    socket.emit('join-room', {
      roomId: meeting.roomId,
      userId: user?.id,
      name: user?.name,
      avatar: user?.avatar,
      audioEnabled,
      videoEnabled
    });

    // Populate historical messages
    setChatMessages(meeting.chatMessages || []);
    setTranscript(meeting.transcript || []);
    setSharedNotes(meeting.aiSummary ? 'Reviewing completed notes' : 'Welcome to IntellMeet notepad. Write notes cooperatively here.');

    // Socket listeners
    socket.on('current-participants', (users: any[]) => {
      setParticipants(users);
    });

    socket.on('user-connected', (newUser: any) => {
      setParticipants(prev => {
        if (!prev.some(u => u.socketId === newUser.socketId)) {
          return [...prev, newUser];
        }
        return prev;
      });

      // Create WebRTC connection as initiator
      createPeerConnection(newUser.socketId, true);

      // push chat notification
      const joinMsg = {
        sender: 'system',
        senderName: 'System',
        text: `${newUser.name} joined the meeting.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, joinMsg]);
    });

    socket.on('user-disconnected', (disconnectedUser: any) => {
      setParticipants(prev => prev.filter(u => u.socketId !== disconnectedUser.socketId));

      // Clean up Peer Connection
      const pc = peerConnectionsRef.current[disconnectedUser.socketId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[disconnectedUser.socketId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[disconnectedUser.socketId];
        return next;
      });

      const exitMsg = {
        sender: 'system',
        senderName: 'System',
        text: `${disconnectedUser.name} left the meeting.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, exitMsg]);
    });

    socket.on('webrtc-offer-received', async ({ fromSocketId, offer }: any) => {
      let pc = peerConnectionsRef.current[fromSocketId];
      if (!pc) {
        pc = createPeerConnection(fromSocketId, false);
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit('webrtc-answer', {
          toSocketId: fromSocketId,
          answer
        });
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    socket.on('webrtc-answer-received', async ({ fromSocketId, answer }: any) => {
      const pc = peerConnectionsRef.current[fromSocketId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Error setting remote answer:', err);
        }
      }
    });

    socket.on('webrtc-ice-candidate-received', async ({ fromSocketId, candidate }: any) => {
      const pc = peerConnectionsRef.current[fromSocketId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('user-audio-toggled', ({ socketId, enabled }: any) => {
      setParticipants(prev => prev.map(p => p.socketId === socketId ? { ...p, audioEnabled: enabled } : p));
    });

    socket.on('user-video-toggled', ({ socketId, enabled }: any) => {
      setParticipants(prev => prev.map(p => p.socketId === socketId ? { ...p, videoEnabled: enabled } : p));
    });

    socket.on('chat-message-received', (message: any) => {
      setChatMessages(prev => [...prev, message]);
    });

    socket.on('chat-typing-status', ({ senderName, isTyping }: any) => {
      setTypingUsers(prev => {
        if (isTyping) {
          if (!prev.includes(senderName)) return [...prev, senderName];
        } else {
          return prev.filter(name => name !== senderName);
        }
        return prev;
      });
    });

    socket.on('note-updated', (content: string) => {
      setSharedNotes(content);
    });

    socket.on('transcript-received', (chunk: any) => {
      setTranscript(prev => [...prev, chunk]);
      if (chunk.speaker) {
        setActiveSpeaker(chunk.speaker === (user?.name || 'You') ? 'You' : chunk.speaker);
      }
    });

    // Real Speech-to-Text Transcription via Web Speech API
    let recognition: any = null;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const resultText = event.results[event.results.length - 1][0].transcript;
        if (resultText.trim() && socketRef.current) {
          socketRef.current.emit('send-transcript-chunk', {
            roomId: meeting.roomId,
            speaker: user?.name || 'You',
            text: resultText.trim()
          });
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
      };

      if (audioEnabled) {
        try {
          recognition.start();
        } catch (e) {
          console.warn('Speech recognition start failed:', e);
        }
      }
    }

    return () => {
      // Clean up Speech Recognition
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) { }
      }

      // Close all active WebRTC connections
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
      setRemoteStreams({});

      socket.disconnect();
    };
  }, [inLobby, meeting]);

  // Screen Sharing
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing, restore to current camera preference
        startCamera(videoEnabled);
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });

        localStreamRef.current = screenStream;
        setLocalStream(screenStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Catch screen share ending via native browser bar
        screenStream.getVideoTracks()[0].onended = () => {
          startCamera(videoEnabled);
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      }
    } catch (err) {
      console.warn('Screen share denied or failed', err);
    }
  };

  // Local Recording using MediaRecorder
  const handleToggleRecording = () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      if (!localStreamRef.current) {
        alert('No camera stream available to record.');
        return;
      }

      recordedChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(localStreamRef.current, {
          mimeType: 'video/webm;codecs=vp9'
        });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);

          // Trigger browser download for demonstration
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `intellmeet-meeting-${meeting?.title || 'recording'}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000); // slice chunks of 1s
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recorder:', err);
        // Fallback for browser constraints
        const recorder = new MediaRecorder(localStreamRef.current);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'meeting.webm';
          a.click();
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      }
    }
  };

  // Chat message send
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socketRef.current) return;

    socketRef.current.emit('send-chat-message', {
      roomId: meeting.roomId,
      userId: user?.id,
      senderName: user?.name,
      text: inputText.trim()
    });

    setInputText('');
    socketRef.current.emit('chat-typing', {
      roomId: meeting.roomId,
      senderName: user?.name,
      isTyping: false
    });
  };

  // Typing state emission
  const handleChatKeyDown = () => {
    if (socketRef.current) {
      socketRef.current.emit('chat-typing', {
        roomId: meeting.roomId,
        senderName: user?.name,
        isTyping: true
      });

      // Clear typing indicator after idle duration
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.emit('chat-typing', {
            roomId: meeting.roomId,
            senderName: user?.name,
            isTyping: false
          });
        }
      }, 3000);
    }
  };

  // Host terminates the call
  const handleEndMeeting = async () => {
    if (!meeting) return;

    const isHost = meeting.host._id === user?.id || meeting.host === user?.id;

    if (isHost) {
      const confirmEnd = window.confirm('Are you sure you want to end this meeting for all participants? This will trigger AI analytics and summaries.');
      if (!confirmEnd) return;

      try {
        const res = await api.put(`/meetings/${meeting.roomId}/end`, {});
        if (res.success) {
          onMeetingEnded(res.data._id);
        } else {
          alert('Could not end meeting.');
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      // Regular participant simply leaves
      onLeave();
    }
  };

  // Reconnecting state on refresh
  if (!inLobby && !meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] h-full text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Reconnecting to meeting room...</p>
      </div>
    );
  }

  // Selection rendering (Launch or Join selection screen)
  if (!hasSelectedRoom) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pt-8 animate-fadeIn">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
            Meeting Room
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-sans">
            Create a new live room or join an existing meeting in this workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box 1: Create Live Meeting */}
          <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between shadow-lg min-h-[250px] hover:border-indigo-500/20 transition-all duration-300">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <VideoIcon className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-semibold text-slate-100 font-sans">Create Live Meeting</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                Launch a live collaborative workspace call instantly.
              </p>
            </div>
            <form onSubmit={handleCreateInstantRoom} className="space-y-4">
              <input
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Enter meeting title..."
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
              />
              <button
                type="submit"
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {isCreating ? 'Creating Room...' : 'Launch Live Room'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Box 2: Join Meeting */}
          <div className="glass-panel p-6 rounded-2xl border-slate-800/60 flex flex-col justify-between shadow-lg min-h-[250px] hover:border-emerald-500/20 transition-all duration-300">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                  <Mic className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-semibold text-slate-100 font-sans">Join via Code</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                Enter a 6-character meeting code (e.g. ABC123) to join.
              </p>
            </div>
            <form onSubmit={handleSelectJoinCode} className="space-y-4">
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
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
        </div>
      </div>
    );
  }

  // Lobby rendering
  if (inLobby) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 pt-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
            Meeting Lobby
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Configure camera and microphone elements prior to room insertion.
          </p>
        </div>

        <div className="glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-2xl">
          {/* Camera View Box */}
          <div className="relative aspect-video bg-slate-950 flex items-center justify-center border-b border-slate-800">
            {videoEnabled && localStream && localStream.getVideoTracks().length > 0 ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center space-y-3 p-6">
                {/* Avatar initial circle — clean, no scary red icon */}
                {user?.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    className="h-20 w-20 rounded-full object-cover mx-auto border-2 border-white/10 shadow-lg"
                  />
                ) : (
                  <div
                    style={{ backgroundColor: user?.avatar || '#6366f1' }}
                    className="h-20 w-20 rounded-full flex items-center justify-center mx-auto border-2 border-white/10 shadow-lg text-white text-2xl font-bold"
                  >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <p className="text-xs text-slate-400 font-medium">
                  {videoEnabled ? 'Enabling camera...' : 'Camera is off'}
                </p>
                {/* Only show error when user explicitly tried to enable camera */}
                {cameraError && videoEnabled && (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] text-amber-400/80 max-w-xs mx-auto leading-normal bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      ⚠ {cameraError}
                    </p>
                    <button
                      onClick={() => startCamera(true)}
                      className="text-[11px] font-semibold px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Float Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 z-10">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`p-3 rounded-full border cursor-pointer transition-all ${audioEnabled
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                  }`}
              >
                {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setVideoEnabled(!videoEnabled)}
                className={`p-3 rounded-full border cursor-pointer transition-all ${videoEnabled
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                  }`}
              >
                {videoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-850/60 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Enter Meeting Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="e.g. ABC123"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-center font-mono tracking-widest text-slate-200"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancelLobby}
                className="flex-1 py-2.5 border border-slate-700/50 text-slate-400 hover:bg-slate-850 hover:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={!roomCode.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Join Meeting
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active meeting room layout
  const isHost = meeting?.host === user?.id || meeting?.host?._id === user?.id;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col md:flex-row gap-4 relative overflow-hidden transition-all duration-300 ${isFullscreen ? 'h-screen w-screen p-4 bg-[var(--bg-dark)]' : 'h-[calc(100vh-8rem)]'
        }`}
    >
      {/* Left pane: Video Grid & Controls */}
      <div className="flex-1 flex flex-col min-h-0 border border-slate-800/80 rounded-2xl overflow-hidden glass-panel shadow-sm">

        {/* Header Indicator */}
        <div className="h-12 px-6 border-b border-slate-850 bg-slate-850/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h1 className="text-base font-bold text-slate-200">{meeting?.title}</h1>
            <span className="text-xs bg-slate-850 px-2.5 py-0.5 rounded text-slate-400 font-mono">
              Room: {meeting?.roomId}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isRecording && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
                Rec
              </span>
            )}
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>{1 + participants.length} Connected</span>
            </div>

            {/* Divider line */}
            <span className="h-4 w-px bg-slate-800" />

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Video Canvas Grid */}
        <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto content-center bg-slate-850">

          {/* Main User Camera */}
          {showSelfView && (
            <div className={`relative rounded-xl overflow-hidden aspect-video bg-slate-950 border transition-all ${activeSpeaker === 'You' ? 'border-indigo-500 active-speaker-ring' : 'border-slate-800/80'
              }`}>
              {videoEnabled && localStream && localStream.getVideoTracks().length > 0 ? (
                <div className="w-full h-full relative overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1] animate-camera-drift" // mirrors webcam & simulates slight physical camera drift
                  />
                  {/* CRT Scanline & Grain Layer */}
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[size:100%_4px] opacity-15 z-10" />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-4 relative text-center">
                  {user?.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) ? (
                    <img
                      src={user.avatar}
                      alt={user.name || 'User'}
                      className="h-16 w-16 rounded-full object-cover mb-2 shadow-lg border border-white/10"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: user?.avatar || '#6366f1' }}
                      className="h-16 w-16 rounded-full flex items-center justify-center font-bold text-xl text-white mb-2 shadow-lg border border-white/10"
                    >
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {cameraError ? 'Camera Connection Failed' : 'Camera Muted'}
                  </p>
                  {cameraError && (
                    <p className="text-xs text-slate-500 max-w-[240px] mt-1 leading-normal">
                      {cameraError}
                    </p>
                  )}
                </div>
              )}

              {/* Nameplate & Mute indicators */}
              <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-800 text-slate-200 flex items-center gap-2 z-20 shadow-md">
                {!audioEnabled ? (
                  <MicOff className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                ) : (
                  <Mic className="h-3.5 w-3.5 text-indigo-400 shrink-0 animate-pulse" />
                )}
                <span>{user?.name} (You)</span>
              </div>

              {/* Live Audio Waveform */}
              <div className="absolute bottom-3 right-3 z-20 shadow-md">
                <ActiveWaveform isSpeaking={activeSpeaker === 'You' && audioEnabled} />
              </div>
            </div>
          )}

          {/* Active WebRTC Peer Connections */}
          {participants.map((peer) => {
            const isSpeaking = activeSpeaker === peer.name;
            const peerStream = remoteStreams[peer.socketId];
            return (
              <div
                key={peer.socketId}
                className={`relative rounded-xl overflow-hidden aspect-video transition-all bg-slate-950 border ${isSpeaking ? 'border-indigo-500 active-speaker-ring' : 'border-slate-800/80'
                  }`}
              >
                {peer.videoEnabled && peerStream ? (
                  <div className="w-full h-full relative overflow-hidden bg-slate-950">
                    <VideoFeed
                      stream={peerStream}
                      className="w-full h-full object-cover scale-x-[-1] animate-camera-drift"
                    />
                    {/* CRT Scanline & Grain Layer */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[size:100%_4px] opacity-15 z-10" />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 relative">
                    {peer.avatar && (peer.avatar.startsWith('http://') || peer.avatar.startsWith('https://')) ? (
                      <img
                        src={peer.avatar}
                        alt={peer.name || 'User'}
                        className="h-16 w-16 rounded-full object-cover mb-2 shadow-lg border border-white/10"
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: peer.avatar || '#6366f1' }}
                        className="h-16 w-16 rounded-full flex items-center justify-center font-bold text-xl text-white mb-2 shadow-lg border border-white/10"
                      >
                        {peer.name ? peer.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Camera Muted</p>
                    {peerStream && <AudioFeed stream={peerStream} />}
                  </div>
                )}

                {/* Nameplate & Mute indicators */}
                <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-800 text-slate-200 flex items-center gap-2 z-20 shadow-md">
                  {!peer.audioEnabled ? (
                    <MicOff className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  )}
                  <span>{peer.name}</span>
                </div>

                {/* Live Audio Waveform */}
                <div className="absolute bottom-3 right-3 z-20 shadow-md">
                  <ActiveWaveform isSpeaking={isSpeaking && peer.audioEnabled} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Video Control Bar */}
        <div className="h-20 border-t border-slate-850 bg-slate-850 flex items-center justify-between px-6">
          {/* Hang up */}
          <button
            onClick={handleEndMeeting}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${isHost
              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/20'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/50'
              }`}
          >
            <PhoneOff className="h-4 w-4" />
            <span>{isHost ? 'End Call' : 'Leave Call'}</span>
          </button>

          {/* Media Toggles */}
          <div className="flex gap-2.5">
            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (socketRef.current) socketRef.current.emit('toggle-audio', { roomId: meeting.roomId, enabled: !audioEnabled });
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${audioEnabled
                ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                }`}
            >
              {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                setVideoEnabled(!videoEnabled);
                if (socketRef.current) socketRef.current.emit('toggle-video', { roomId: meeting.roomId, enabled: !videoEnabled });
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${videoEnabled
                ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                }`}
            >
              {videoEnabled ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>

            <button
              onClick={() => setShowSelfView(!showSelfView)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${showSelfView
                ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20'
                }`}
              title={showSelfView ? "Hide Self-View" : "Show Self-View"}
            >
              {showSelfView ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>

            <button
              onClick={handleToggleScreenShare}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${isScreenSharing
                ? 'bg-indigo-600 border-indigo-500/20 text-white hover:bg-indigo-500'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              title="Share Screen"
            >
              <Monitor className="h-4 w-4" />
            </button>

            <button
              onClick={handleToggleRecording}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${isRecording
                ? 'bg-rose-600 border-rose-500/20 text-white hover:bg-rose-500 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              title="Record Meeting"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          </div>

          {/* Sidebar Toggle options */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')}
              className={`p-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${activeSidebar === 'chat'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              title="Meeting Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveSidebar(activeSidebar === 'notes' ? null : 'notes')}
              className={`p-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${activeSidebar === 'notes'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              title="Collaborative Notepad"
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveSidebar(activeSidebar === 'transcript' ? null : 'transcript')}
              className={`p-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${activeSidebar === 'transcript'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              title="Live Transcript"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right pane: Drawer sidebar (Tabs content) */}
      {activeSidebar && (
        <div className="w-full md:w-80 shrink-0 border border-slate-800 rounded-2xl flex flex-col min-h-0 overflow-hidden glass-panel shadow-sm">

          {/* Sidebar Tab Selector header */}
          <div className="h-12 border-b border-slate-850 px-4 flex items-center justify-between bg-slate-850/50">
            <h3 className="text-sm font-bold text-slate-200 capitalize">
              {activeSidebar === 'chat' && 'Meeting Chat'}
              {activeSidebar === 'notes' && 'Shared Notepad'}
              {activeSidebar === 'transcript' && 'Real-time Transcript'}
            </h3>
            <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold px-2.5 py-0.5 rounded">
              Sync Active
            </span>
          </div>

          {/* Sidebar Views */}
          <div className="flex-1 min-h-0 p-4 overflow-y-auto">
            {activeSidebar === 'chat' && (
              <div className="h-full flex flex-col">
                {/* Chat Message Lists */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-1 mb-4 text-sm">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      No messages sent yet.
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => {
                      const isMe = msg.sender === user?.id;
                      if (msg.sender === 'system') {
                        return (
                          <div key={i} className="text-center text-xs text-slate-500 italic py-1">
                            {msg.text}
                          </div>
                        );
                      }
                      return (
                        <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-xs text-slate-500 mb-0.5">{msg.senderName}</span>
                          <div className={`px-3 py-2 rounded-lg max-w-[85%] break-words ${isMe ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'
                            }`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing Indicator */}
                  {typingUsers.length > 0 && (
                    <div className="text-xs text-slate-500 italic">
                      {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </div>
                  )}
                </div>

                {/* Chat Inputs */}
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg cursor-pointer shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}

            {activeSidebar === 'notes' && meeting && (
              <NotePad
                meetingId={meeting._id}
                sharedNotesText={sharedNotes}
                onSharedNotesChange={(text) => {
                  setSharedNotes(text);
                  if (socketRef.current) {
                    socketRef.current.emit('sync-note', {
                      roomId: meeting.roomId,
                      content: text
                    });
                  }
                }}
              />
            )}

            {activeSidebar === 'transcript' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Transcribing verbal streams via Whisper models...
                </p>
                <div className="space-y-3.5 text-sm max-h-[400px] overflow-y-auto">
                  {transcript.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs py-12">
                      Waiting for voice streams... Speak into your mic to trigger.
                    </div>
                  ) : (
                    transcript.map((chunk, i) => (
                      <div key={i} className="border-l-2 border-indigo-500/50 pl-3 py-0.5">
                        <span className="font-bold text-slate-300 block text-xs">
                          {chunk.speaker}
                        </span>
                        <span className="text-slate-400 text-sm mt-0.5 block leading-relaxed">
                          {chunk.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
