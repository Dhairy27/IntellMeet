import Meeting from '../models/Meeting.js';

export const handleSocketConnections = (io) => {
  // Store active room participants
  // Structure: { roomId: { socketId: { userId, name, avatar, audioEnabled, videoEnabled } } }
  const activeRooms = {};

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
        await Meeting.findOneAndUpdate(
          { roomId },
          { $addToSet: { participants: userId }, status: 'live' }
        );
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
      rooms.forEach((roomId) => {
        if (activeRooms[roomId] && activeRooms[roomId][socket.id]) {
          const userDetails = activeRooms[roomId][socket.id];
          delete activeRooms[roomId][socket.id];

          // If no one is left in the room, clean it up
          if (Object.keys(activeRooms[roomId]).length === 0) {
            delete activeRooms[roomId];
          } else {
            // Notify others that the user disconnected
            socket.to(roomId).emit('user-disconnected', {
              socketId: socket.id,
              userId: userDetails.userId,
              name: userDetails.name,
            });
          }
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Connection closed: ${socket.id}`);
    });
  });
};
