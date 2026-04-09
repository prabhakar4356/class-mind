const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const path   = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e7,
});

const PORT = process.env.PORT || 5000;

// ─── In-Memory Data Store ─────────────────────────────────────────────
const classrooms = {};

function generateRoomId() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ─── REST API ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0' }));

app.post('/api/create-room', (req, res) => {
  const { teacherName } = req.body;
  if (!teacherName) return res.status(400).json({ error: 'teacherName required' });

  let roomId;
  do { roomId = generateRoomId(); } while (classrooms[roomId]);

  classrooms[roomId] = {
    roomId, teacherName,
    teacherSocketId: null,
    createdAt: new Date(),
    sessionStart: null,
    students:     {},
    waitingRoom:  {},
    attendanceLog: [], // Store all student entries here
    alerts:       [],
    messages:     [],
    transcript:   [],
    raisedHands:  [],
    poll:         null,
    pinnedStudent: null,
  };

  res.json({ roomId, teacherName });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = classrooms[req.params.roomId.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    roomId: room.roomId,
    teacherName: room.teacherName,
    studentCount: Object.keys(room.students).length,
    waitingCount: Object.keys(room.waitingRoom).length,
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/socket.io/')) return; // Let Socket.IO handle it
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Socket.IO ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // ── Teacher joins ──────────────────────────────────────────────────
  socket.on('teacher-join', ({ roomId, teacherName }) => {
    const room = classrooms[roomId.toUpperCase()];
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

    room.teacherSocketId = socket.id;
    room.sessionStart = room.sessionStart || new Date();
    socket.join(roomId);
    socket.data = { roomId, role: 'teacher', username: teacherName };

    socket.emit('room-joined', {
      roomId, role: 'teacher', teacherName,
      students:        Object.values(room.students),
      waitingStudents: Object.values(room.waitingRoom),
      alerts:          room.alerts.slice(-100),
      messages:        room.messages.slice(-50),
      transcript:      room.transcript.slice(-100),
      raisedHands:     room.raisedHands,
      poll:            room.poll,
      sessionStart:    room.sessionStart,
      attendanceLog:   room.attendanceLog,
    });

    broadcastStudentList(roomId);
    socket.to(roomId).emit('teacher-joined-notification', {
      teacherName, teacherSocketId: socket.id,
    });
  });

  // ── Student requests to join (enters waiting room) ─────────────────
  socket.on('request-join', ({ roomId, username }) => {
    const room = classrooms[roomId.toUpperCase()];
    if (!room) { socket.emit('error', { message: 'Room not found. Check your Classroom ID.' }); return; }

    socket.data = { roomId, role: 'student-waiting', username };
    room.waitingRoom[socket.id] = { socketId: socket.id, username, requestedAt: new Date() };

    if (room.teacherSocketId) {
      io.to(room.teacherSocketId).emit('waiting-room-update', {
        waitingStudents: Object.values(room.waitingRoom),
      });
    }
    socket.emit('waiting-for-admission', { teacherName: room.teacherName, roomId });
  });

  // ── Teacher admits one student ─────────────────────────────────────
  socket.on('admit-student', ({ socketId }) => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) {
      console.error(`[ADMIT ERROR] Room ${roomId} not found for teacher ${socket.id}`);
      return;
    }

    const waiting = room.waitingRoom[socketId];
    if (!waiting) {
      console.warn(`[ADMIT WARN] Student ${socketId} not in waiting room of ${roomId}`);
      return;
    }
    delete room.waitingRoom[socketId];

    const studentSocket = io.sockets.sockets.get(socketId);
    if (!studentSocket) {
      console.warn(`[ADMIT WARN] Socket ${socketId} no longer active`);
      return;
    }

    studentSocket.join(roomId);
    studentSocket.data = { roomId, role: 'student', username: waiting.username };

    room.students[socketId] = {
      socketId, username: waiting.username,
      status: 'Focused', joinedAt: new Date(), alertCount: 0,
    };

    room.attendanceLog.push({
      username: waiting.username,
      joinedAt: new Date(),
    });

    if (room.teacherSocketId) {
      io.to(room.teacherSocketId).emit('attendance-update', { attendanceLog: room.attendanceLog });
    }

    console.log(`[ADMIT] ${waiting.username} joined ${roomId}`);
    studentSocket.emit('student-admitted', {
      roomId, role: 'student', username: waiting.username,
      teacherName: room.teacherName, teacherSocketId: room.teacherSocketId,
      messages: room.messages.slice(-50),
      students: Object.values(room.students),
      poll: room.poll,
      raisedHands: room.raisedHands,
    });

    broadcastStudentList(roomId);
    socket.emit('waiting-room-update', { waitingStudents: Object.values(room.waitingRoom) });
    if (room.teacherSocketId) {
      io.to(room.teacherSocketId).emit('student-joined-notification', { username: waiting.username });
    }
  });

  // ── Teacher admits ALL waiting ─────────────────────────────────────
  socket.on('admit-all', () => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) return;

    Object.keys(room.waitingRoom).forEach(sid => {
      const waiting = room.waitingRoom[sid];
      if (!waiting) return;
      delete room.waitingRoom[sid];

      const studentSocket = io.sockets.sockets.get(sid);
      if (!studentSocket) return;

      studentSocket.join(roomId);
      studentSocket.data = { roomId, role: 'student', username: waiting.username };
      room.students[sid] = {
        socketId: sid, username: waiting.username,
        status: 'Focused', joinedAt: new Date(), alertCount: 0,
      };

      room.attendanceLog.push({
        username: waiting.username,
        joinedAt: new Date(),
      });

      studentSocket.emit('student-admitted', {
        roomId, role: 'student', username: waiting.username,
        teacherName: room.teacherName, teacherSocketId: room.teacherSocketId,
        messages: room.messages.slice(-50),
        students: Object.values(room.students),
        poll: room.poll, raisedHands: room.raisedHands,
      });
    });

    broadcastStudentList(roomId);
    socket.emit('attendance-update', { attendanceLog: room.attendanceLog });
    socket.emit('waiting-room-update', { waitingStudents: [] });
  });

  // ── Teacher denies a student ───────────────────────────────────────
  socket.on('deny-student', ({ socketId }) => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) return;
    delete room.waitingRoom[socketId];
    const s = io.sockets.sockets.get(socketId);
    if (s) s.emit('admission-denied', {});
    socket.emit('waiting-room-update', { waitingStudents: Object.values(room.waitingRoom) });
  });

  // ── Teacher kicks a student ────────────────────────────────────────
  socket.on('kick-student', ({ socketId }) => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) return;

    const s = io.sockets.sockets.get(socketId);
    if (s) { s.emit('you-were-removed', {}); s.leave(roomId); }
    delete room.students[socketId];
    room.raisedHands = room.raisedHands.filter(h => h.socketId !== socketId);
    broadcastStudentList(roomId);
    io.to(roomId).emit('hand-raised-update', { raisedHands: room.raisedHands });
  });

  // ── Mute all students ─────────────────────────────────────────────
  socket.on('mute-all', () => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    socket.to(roomId).emit('teacher-muted-you');
  });

  // ── Pin / Unpin student ───────────────────────────────────────────
  socket.on('pin-student', ({ socketId }) => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) return;
    room.pinnedStudent = socketId;
    io.to(roomId).emit('student-pinned', { socketId });
  });

  socket.on('unpin-student', () => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) return;
    room.pinnedStudent = null;
    io.to(roomId).emit('student-pinned', { socketId: null });
  });

  // ── Engagement update ─────────────────────────────────────────────
  socket.on('engagement-update', ({ status }) => {
    const { roomId, username, role } = socket.data || {};
    if (!roomId || role !== 'student') return;
    const room = classrooms[roomId];
    if (!room || !room.students[socket.id]) return;

    room.students[socket.id].status = status;
    if (status === 'Distracted' || status === 'Drowsy') {
      room.students[socket.id].alertCount++;
      const alert = { studentName: username, status, timestamp: new Date() };
      room.alerts.push(alert);
      if (room.alerts.length > 500) room.alerts.shift();
      if (room.teacherSocketId) io.to(room.teacherSocketId).emit('teacher-alert', alert);
    }
    broadcastStudentList(roomId);
  });

  // ── Video Frame ───────────────────────────────────────────────────
  socket.on('video-frame', ({ roomId, frameData }) => {
    socket.to(roomId).emit('video-frame', { socketId: socket.id, frameData });
  });

  // ── Chat ──────────────────────────────────────────────────────────
  socket.on('chat-message', ({ message }) => {
    const { roomId, username } = socket.data || {};
    if (!roomId) return;
    const msg = { username, message, timestamp: new Date(), socketId: socket.id };
    const room = classrooms[roomId];
    if (room) { room.messages.push(msg); if (room.messages.length > 500) room.messages.shift(); }
    io.to(roomId).emit('chat-message', msg);
  });

  // ── Transcript ────────────────────────────────────────────────────
  socket.on('transcript-message', ({ text }) => {
    const { roomId, username } = socket.data || {};
    if (!roomId) return;
    const line = { username, text, timestamp: new Date() };
    const room = classrooms[roomId];
    if (room) { room.transcript.push(line); if (room.transcript.length > 1000) room.transcript.shift(); }
    io.to(roomId).emit('transcript-message', line);
  });

  // ── Raise Hand ────────────────────────────────────────────────────
  socket.on('raise-hand', () => {
    const { roomId, username } = socket.data || {};
    if (!roomId) return;
    const room = classrooms[roomId];
    if (!room) return;
    if (!room.raisedHands.find(h => h.socketId === socket.id)) {
      room.raisedHands.push({ socketId: socket.id, username, timestamp: new Date() });
    }
    io.to(roomId).emit('hand-raised-update', { raisedHands: room.raisedHands });
    if (room.teacherSocketId) {
      io.to(room.teacherSocketId).emit('student-raised-hand', { username, socketId: socket.id });
    }
  });

  socket.on('lower-hand', () => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const room = classrooms[roomId];
    if (!room) return;
    room.raisedHands = room.raisedHands.filter(h => h.socketId !== socket.id);
    io.to(roomId).emit('hand-raised-update', { raisedHands: room.raisedHands });
  });

  socket.on('lower-all-hands', () => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) return;
    room.raisedHands = [];
    io.to(roomId).emit('hand-raised-update', { raisedHands: [] });
    socket.to(roomId).emit('teacher-lowered-hands');
  });

  // ── Reactions ─────────────────────────────────────────────────────
  socket.on('send-reaction', ({ emoji }) => {
    const { roomId, username } = socket.data || {};
    if (!roomId) return;
    io.to(roomId).emit('reaction-received', { emoji, username, socketId: socket.id });
  });

  // ── Polls ─────────────────────────────────────────────────────────
  socket.on('create-poll', ({ question, options }) => {
    const { roomId, role, username } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room) return;
    room.poll = {
      question, options, createdBy: username,
      votes: Object.fromEntries(options.map((_, i) => [i, []])),
      createdAt: new Date(), active: true,
    };
    io.to(roomId).emit('poll-started', { poll: room.poll });
  });

  socket.on('submit-vote', ({ optionIndex }) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const room = classrooms[roomId];
    if (!room || !room.poll || !room.poll.active) return;
    // Remove existing vote
    Object.values(room.poll.votes).forEach(voters => {
      const i = voters.indexOf(socket.id);
      if (i !== -1) voters.splice(i, 1);
    });
    if (room.poll.votes[optionIndex]) room.poll.votes[optionIndex].push(socket.id);
    const results = room.poll.options.map((opt, i) => ({
      option: opt, count: room.poll.votes[i].length,
    }));
    io.to(roomId).emit('poll-results-update', {
      results, totalVoters: Object.keys(room.students).length,
    });
  });

  socket.on('end-poll', () => {
    const { roomId, role } = socket.data || {};
    if (role !== 'teacher') return;
    const room = classrooms[roomId];
    if (!room || !room.poll) return;
    room.poll.active = false;
    const results = room.poll.options.map((opt, i) => ({
      option: opt, count: room.poll.votes[i].length,
    }));
    io.to(roomId).emit('poll-ended', { results, question: room.poll.question });
    room.poll = null;
  });

  // ── Announcement ──────────────────────────────────────────────────
  socket.on('broadcast-announcement', ({ message }) => {
    const { roomId, role, username } = socket.data || {};
    if (role !== 'teacher') return;
    io.to(roomId).emit('announcement', { message, from: username, timestamp: new Date() });
  });

  // ── WebRTC Signaling ──────────────────────────────────────────────
  socket.on('webrtc-offer',  ({ targetSocketId, offer,  fromSocketId }) => io.to(targetSocketId).emit('webrtc-offer',  { offer,  fromSocketId }));
  socket.on('webrtc-answer', ({ targetSocketId, answer, fromSocketId }) => io.to(targetSocketId).emit('webrtc-answer', { answer, fromSocketId }));
  socket.on('webrtc-ice',    ({ targetSocketId, candidate, fromSocketId }) => io.to(targetSocketId).emit('webrtc-ice', { candidate, fromSocketId }));

  // ── Disconnect ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { roomId, username, role } = socket.data || {};
    if (!roomId || !classrooms[roomId]) return;
    const room = classrooms[roomId];

    if (role === 'student') {
      if (room.students[socket.id]) room.students[socket.id].leftAt = new Date();
      delete room.students[socket.id];
      room.raisedHands = room.raisedHands.filter(h => h.socketId !== socket.id);
      broadcastStudentList(roomId);
      io.to(roomId).emit('hand-raised-update', { raisedHands: room.raisedHands });
    } else if (role === 'student-waiting') {
      delete room.waitingRoom[socket.id];
      if (room.teacherSocketId) {
        io.to(room.teacherSocketId).emit('waiting-room-update', {
          waitingStudents: Object.values(room.waitingRoom),
        });
      }
    } else if (role === 'teacher') {
      room.teacherSocketId = null;
      io.to(roomId).emit('teacher-left', {});
    }
    console.log(`[DISCONNECT] ${username} (${role}) from ${roomId}`);
  });
});

function broadcastStudentList(roomId) {
  const room = classrooms[roomId];
  if (!room) return;
  io.to(roomId).emit('student-list-update', { students: Object.values(room.students) });
}

server.listen(PORT, () => {
  console.log(`\n🚀 ClassMind AI v2.0 running on http://localhost:${PORT}\n`);
});
