import Meeting from '../models/Meeting.js';

export const handleSocketConnections = (io) => {
  // Store active room participants
  // Structure: { roomId: { socketId: { userId, name, avatar, audioEnabled, videoEnabled } } }
  const activeRooms = {};

  // Store active host timeout references for automatic termination
  const hostTimeoutRefs = {};

  io.on('connection', (socket) => {
    console.log(`[Socket] New connection established: ${socket.id}`);

    // Join meeting room
    socket.on('join-room', async ({ roomId, userId, name, avatar, audioEnabled, videoEnabled }) => {
      console.log(`[Socket] User ${name} (${userId}) joining room ${roomId}`);

      socket.join(roomId);

      // Store socket details
      if (!activeRooms[roomId]) {
        activeRooms[roomId] = {};
      }

      activeRooms[roomId][socket.id] = {
        socketId: socket.id,
        userId,
        name,
        avatar,
        audioEnabled: audioEnabled !== false,
        videoEnabled: videoEnabled !== false,
      };

      // Notify others in room
      socket.to(roomId).emit('user-connected', activeRooms[roomId][socket.id]);

      // Send current participant list back to the joining user
      const currentParticipants = Object.values(activeRooms[roomId]).filter(p => p.socketId !== socket.id);
      socket.emit('current-participants', currentParticipants);

      // Add user to meeting schema participants in db
      try {
        const meeting = await Meeting.findOneAndUpdate(
          { roomId },
          { $addToSet: { participants: userId }, status: 'live' },
          { new: true }
        );

        if (meeting) {
          const hostId = meeting.hostId || meeting.host;
          const hostIdStr = hostId ? hostId.toString() : '';
          if (hostIdStr === userId.toString()) {
            console.log(`[Socket] Host has joined/rejoined room ${roomId}. Clearing auto-end timer.`);
            if (hostTimeoutRefs[roomId]) {
              clearTimeout(hostTimeoutRefs[roomId]);
              delete hostTimeoutRefs[roomId];
            }
          }
        }
      } catch (err) {
        console.error('[Socket DB Error] Failed to update participants:', err.message);
      }
    });

    // WebRTC Signaling relays
    socket.on('webrtc-offer', ({ toSocketId, offer }) => {
      io.to(toSocketId).emit('webrtc-offer-received', {
        fromSocketId: socket.id,
        offer,
      });
    });

    socket.on('webrtc-answer', ({ toSocketId, answer }) => {
      io.to(toSocketId).emit('webrtc-answer-received', {
        fromSocketId: socket.id,
        answer,
      });
    });

    socket.on('webrtc-ice-candidate', ({ toSocketId, candidate }) => {
      io.to(toSocketId).emit('webrtc-ice-candidate-received', {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // Mute/Unmute toggles broadcast
    socket.on('toggle-audio', ({ roomId, enabled }) => {
      if (activeRooms[roomId] && activeRooms[roomId][socket.id]) {
        activeRooms[roomId][socket.id].audioEnabled = enabled;
        socket.to(roomId).emit('user-audio-toggled', {
          socketId: socket.id,
          enabled,
        });
      }
    });

    socket.on('toggle-video', ({ roomId, enabled }) => {
      if (activeRooms[roomId] && activeRooms[roomId][socket.id]) {
        activeRooms[roomId][socket.id].videoEnabled = enabled;
        socket.to(roomId).emit('user-video-toggled', {
          socketId: socket.id,
          enabled,
        });
      }
    });

    // Real-Time Chat message
    socket.on('send-chat-message', async ({ roomId, userId, senderName, text }) => {
      const message = {
        sender: userId,
        senderName,
        text,
        timestamp: new Date(),
      };

      console.log(`[Socket Chat] Room ${roomId} from ${senderName}: ${text}`);

      // Broadcast to room
      io.to(roomId).emit('chat-message-received', message);

      // Save to database
      try {
        await Meeting.findOneAndUpdate(
          { roomId },
          { $push: { chatMessages: message } }
        );
      } catch (err) {
        console.error('[Socket DB Error] Failed to save chat message:', err.message);
      }
    });

    // Typing Indicators
    socket.on('chat-typing', ({ roomId, senderName, isTyping }) => {
      socket.to(roomId).emit('chat-typing-status', {
        senderName,
        isTyping,
      });
    });

    // Real-Time Note Synchronization
    socket.on('sync-note', ({ roomId, content }) => {
      socket.to(roomId).emit('note-updated', content);
    });

    // Live Transcription chunks
    socket.on('send-transcript-chunk', async ({ roomId, speaker, text }) => {
      const chunk = {
        speaker,
        text,
        timestamp: new Date(),
      };

      // Broadcast to room
      io.to(roomId).emit('transcript-received', chunk);

      // Save to database
      try {
        await Meeting.findOneAndUpdate(
          { roomId },
          { $push: { transcript: chunk } }
        );
      } catch (err) {
        console.error('[Socket DB Error] Failed to save transcript chunk:', err.message);
      }
    });

    // Disconnect handler
    socket.on('disconnecting', () => {
      // Find all rooms this socket was in and remove it from active tracking
      const rooms = Array.from(socket.rooms);
      rooms.forEach(async (roomId) => {
        if (activeRooms[roomId] && activeRooms[roomId][socket.id]) {
          const userDetails = activeRooms[roomId][socket.id];
          delete activeRooms[roomId][socket.id];

          // Notify others that the user disconnected
          socket.to(roomId).emit('user-disconnected', {
            socketId: socket.id,
            userId: userDetails.userId,
            name: userDetails.name,
          });

          // Check if this user is the host of the meeting
          try {
            const meeting = await Meeting.findOne({ roomId });
            if (meeting && meeting.status === 'live') {
              const hostId = meeting.hostId || meeting.host;
              const hostIdStr = hostId ? hostId.toString() : '';
              if (hostIdStr === userDetails.userId.toString()) {
                console.log(`[Socket] Host (${userDetails.name}) left room ${roomId}. Starting 10-minute auto-end timer.`);
                
                // Clear any existing timeout first just in case
                if (hostTimeoutRefs[roomId]) {
                  clearTimeout(hostTimeoutRefs[roomId]);
                }

                // Start 10 min timer (10 * 60 * 1000)
                const timeoutId = setTimeout(async () => {
                  console.log(`[Socket] Host did not rejoin room ${roomId} within 10 minutes. Ending meeting automatically.`);
                  delete hostTimeoutRefs[roomId];
                  
                  try {
                    // Import models and AI service dynamically
                    const MeetingParticipant = (await import('../models/MeetingParticipant.js')).default;
                    const { generateMeetingIntelligence } = await import('./ai.service.js');

                    // End the meeting in DB
                    const currentMeeting = await Meeting.findOne({ roomId });
                    if (currentMeeting && currentMeeting.status === 'live') {
                      currentMeeting.status = 'completed';
                      currentMeeting.actualEndTime = new Date();

                      // Mark active participants as left
                      const activeParticipants = await MeetingParticipant.find({
                        meetingId: currentMeeting._id,
                        leftAt: null
                      });

                      const now = new Date();
                      await Promise.all(activeParticipants.map(async (part) => {
                        part.leftAt = now;
                        part.attendanceDuration = Math.max(0, Math.round((now.getTime() - part.joinedAt.getTime()) / 1000));
                        await part.save();
                      }));

                      // Generate AI intelligence summary
                      console.log(`[AI Trigger] Meeting ${currentMeeting.title} ended automatically. Extracting summary...`);
                      const aiResults = await generateMeetingIntelligence(currentMeeting);
                      currentMeeting.aiSummary = aiResults.summary;
                      currentMeeting.aiActionItems = aiResults.actionItems;
                      currentMeeting.recordingUrl = '';

                      await currentMeeting.save();

                      // Notify all remaining clients in the room to end/leave the meeting
                      io.to(roomId).emit('meeting-ended', { meetingId: currentMeeting._id });
                      console.log(`[Socket] Sent meeting-ended notification to room ${roomId}`);
                    }
                  } catch (e) {
                    console.error('[Socket Auto-End Error] Failed to auto-end meeting:', e.message);
                  }
                }, 10 * 60 * 1000); // 10 minutes
                
                hostTimeoutRefs[roomId] = timeoutId;
              }
            }
          } catch (err) {
            console.error('[Socket DB Error] Failed to check host status on disconnect:', err.message);
          }

          // If no one is left in the room, clean it up
          if (Object.keys(activeRooms[roomId]).length === 0) {
            delete activeRooms[roomId];
          }
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Connection closed: ${socket.id}`);
    });
  });
};
