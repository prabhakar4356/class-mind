/* 
 * App.jsx – ClassMind AI v3.0 Main Dashboard
 * Modern 3-Panel Layout & AI Integration
 */

// ══════════════════════════════════════════════════
//  Teacher Dashboard
// ══════════════════════════════════════════════════
function TeacherDashboard({ user, roomId, socket, onLeave, joinSettings }) {
  const [students, setStudents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [frames, setFrames] = useState({});
  const [waitingList, setWaitingList] = useState([]);
  const [poll, setPoll] = useState(null);
  const [pollResults, setPollResults] = useState(null);
  const [raisedHands, setRaisedHands] = useState([]);
  const [timerStr, setTimerStr] = useState('00:00');
  const [sessionStart, setSessionStart] = useState(null);
  const [toast, setToast] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [pinnedId, setPinnedId] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);

  // Shared state for sidebar
  window._waitingList = waitingList;
  window._onAdmit = (sid) => socket.emit('admit-student', { socketId: sid });
  window._sessionTranscript = transcript;

  useEffect(() => {
    socket.emit('teacher-join', { roomId, teacherName: user.username });
    
    socket.on('room-joined', d => {
      setStudents(d.students || []); setAlerts(d.alerts || []);
      setMessages(d.messages || []); setSessionStart(d.sessionStart);
      setTranscript(d.transcript || []);
      setAttendanceLog(d.attendanceLog || []);
    });

    socket.on('student-list-update', ({ students }) => setStudents(students));
    socket.on('video-frame', ({ socketId, frameData }) => setFrames(p => ({ ...p, [socketId]: frameData })));
    socket.on('teacher-alert', a => { setAlerts(p => [...p, a]); setToast(`🚨 Alert: ${a.studentName} is ${a.status.toLowerCase()}`); setTimeout(() => setToast(''), 4000); });
    socket.on('chat-message', m => setMessages(p => [...p, m]));
    socket.on('transcript-message', line => setTranscript(p => [...p, line]));
    socket.on('waiting-room-update', ({ waitingStudents }) => setWaitingList(waitingStudents));
    socket.on('poll-started', ({ poll }) => { setPoll(poll); setToast('📊 Live poll started'); setTimeout(() => setToast(''), 3000); });
    socket.on('poll-results-update', ({ results }) => setPollResults(results));
    socket.on('poll-ended', () => { setPoll(null); setPollResults(null); });
    socket.on('hand-raised-update', ({ raisedHands }) => setRaisedHands(raisedHands));
    socket.on('attendance-update', ({ attendanceLog }) => setAttendanceLog(attendanceLog));
    socket.on('announcement', (a) => setAnnouncements(p => [...p, a]));
    socket.on('error', ({ message }) => alert(message));
    
    return () => {
      ['room-joined', 'student-list-update', 'video-frame', 'teacher-alert', 'chat-message', 'waiting-room-update', 'poll-started', 'poll-results-update', 'poll-ended', 'hand-raised-update', 'attendance-update', 'announcement', 'error'].forEach(e => socket.off(e));
    };
  }, []);

  useEffect(() => {
    if (!sessionStart) return;
    const interval = setInterval(() => {
      const s = Math.floor((Date.now() - new Date(sessionStart)) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setTimerStr(`${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const pinStudent = (sid) => setPinnedId(pinnedId === sid ? null : sid);
  const kickStudent = (sid) => { if (confirm("Remove student?")) socket.emit('kick-student', { socketId: sid }); };
  const admitStudent = (sid) => socket.emit('admit-student', { socketId: sid });
  const denyStudent = (sid) => socket.emit('deny-student', { socketId: sid });
  const admitAll = () => socket.emit('admit-all');

  // Shared state for sidebar admission fallback
  window._waitingList = waitingList;
  window._onAdmit = admitStudent;

  useEffect(() => {
    if (waitingList.length > 0) {
       try {
         const ctx = new (window.AudioContext || window.webkitAudioContext)();
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.connect(gain); gain.connect(ctx.destination);
         osc.frequency.value = 523.25; // C5
         gain.gain.value = 0.05;
         osc.start(); osc.stop(ctx.currentTime + 0.1);
       } catch(e){}
    }
  }, [waitingList.length]);

  return (
    <div className="classroom-dashboard">
      <nav className="nav-bar">
        <div className="nav-brand"><i className="ph-fill ph-brain"></i> ClassMind AI</div>
        <div className="session-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '40px', border: '1px solid var(--border)' }}>
            <span className="recording-dot"></span>
            <span className="timer">{timerStr}</span>
          </div>
          <div className="room-id-container" style={{ margin: 0, padding: '4px 16px', borderRadius: '40px' }}>
            <span className="room-id-text" style={{ fontSize: '1rem' }}>{roomId}</span>
          </div>
        </div>
        <div className="control-group">
          <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`); setToast("Clipboard updated."); setTimeout(() => setToast(''), 2000); }}><i className="ph ph-share"></i> Invite</button>
          <button className="btn btn-danger btn-sm" onClick={() => setShowEndModal(true)}><i className="ph ph-phone-disconnect"></i> End Class</button>
        </div>
      </nav>

      <div className="dashboard-grid" style={{ gridTemplateColumns: showChat ? '320px 1fr 340px' : '0px 1fr 340px' }}>
        {showChat && (
          <InteractionSidebar 
            user={user} 
            messages={messages} 
            socket={socket} 
            students={students} 
            raisedHands={raisedHands} 
            poll={poll} 
            pollResults={pollResults} 
          />
        )}
        {!showChat && <div style={{ overflow: 'hidden' }}></div>}

        <div className="viewport-center">
          <div className="video-canvas">
            <MyVideoTile username={user.username} role="teacher" socket={socket} roomId={roomId} audioEnabled={joinSettings?.audioEnabled} videoEnabled={joinSettings?.videoEnabled} />
            {students.map(s => (
              <RemoteTile 
                key={s.socketId} 
                student={s} 
                frameData={frames[s.socketId]} 
                isTeacherView 
                onPin={pinStudent} 
                onKick={kickStudent} 
                isPinned={pinnedId === s.socketId} 
                raisedHand={raisedHands.some(h => h.socketId === s.socketId)} 
              />
            ))}
          </div>
        </div>

        <AIEngagementSidebar students={students} alerts={alerts} attendanceLog={attendanceLog} roomId={roomId} />
      </div>

      <div className="control-bar">
        <div className="control-group">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connected as <b>Prof. {user.username}</b></span>
        </div>
        <div className="control-group">
          <button className={`icon-action ${!window._myTileControls?.audio ? 'off' : ''}`} onClick={() => window._myTileControls?.toggleAudio()}><i className={`ph ph-microphone${!window._myTileControls?.audio ? '-slash' : ''}`}></i></button>
          <button className={`icon-action ${!window._myTileControls?.video ? 'off' : ''}`} onClick={() => window._myTileControls?.toggleVideo()}><i className={`ph ph-video-camera${!window._myTileControls?.video ? '-slash' : ''}`}></i></button>
          <button className={`icon-action ${window._myTileControls?.sharing ? 'active' : ''}`} onClick={() => window._myTileControls?.setSharing(!window._myTileControls?.sharing)}><i className="ph ph-monitor"></i></button>
          <ScreenRecorder roomId={roomId} username={user.username} />
        </div>
          <button className={`icon-action ${showChat ? 'active' : ''}`} onClick={() => setShowChat(!showChat)} title="Toggle Chat"><i className="ph ph-chat-centered-text"></i></button>
          <button className="icon-action" onClick={() => socket.emit('mute-all')} title="Mute Everyone"><i className="ph ph-bell-slash"></i></button>
          <button className="icon-action" onClick={() => socket.emit('lower-all-hands')} title="Lower All Hands"><i className="ph ph-hand-palm"></i></button>
        </div>

        {showEndModal && <EndSessionModal students={students} alerts={alerts} sessionStart={sessionStart} onConfirm={onLeave} onClose={() => setShowEndModal(false)} />}
        <WaitingRoomModal 
          waitingList={waitingList} 
          onAdmit={admitStudent} 
          onDeny={denyStudent} 
          onAdmitAll={admitAll} 
        />
        <NotificationCenter toast={toast} announcements={announcements} />
      </div>
    );
  }

// ══════════════════════════════════════════════════
//  Student Dashboard
// ══════════════════════════════════════════════════
function StudentDashboard({ user, roomId, socket, onLeave, joinSettings, admissionData }) {
  const [students, setStudents] = useState(admissionData?.students || []);
  const [messages, setMessages] = useState(admissionData?.messages || []);
  const [frames, setFrames] = useState({});
  const [teacher, setTeacher] = useState({ 
    username: admissionData?.teacherName || '', 
    socketId: admissionData?.teacherSocketId || null 
  });
  const [poll, setPoll] = useState(null);
  const [pollResults, setPollResults] = useState(null);
  const [myHand, setMyHand] = useState(false);
  const [toast, setToast] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    socket.on('student-admitted', d => {
      setTeacher({ username: d.teacherName, socketId: d.teacherSocketId });
      setMessages(d.messages || []); setStudents(d.students || []);
      setPoll(d.poll);
    });

    socket.on('student-list-update', ({ students }) => setStudents(students));
    socket.on('video-frame', ({ socketId, frameData }) => setFrames(p => ({ ...p, [socketId]: frameData })));
    socket.on('chat-message', m => setMessages(p => [...p, m]));
    socket.on('poll-started', ({ poll }) => { setPoll(poll); setToast("New poll launched by instructor."); });
    socket.on('poll-results-update', ({ results }) => setPollResults(results));
    socket.on('poll-ended', () => { setPoll(null); setPollResults(null); });
    socket.on('teacher-left', () => { setToast("The instructor has disconnected."); });
    socket.on('teacher-joined-notification', d => {
      setTeacher({ username: d.teacherName, socketId: d.teacherSocketId });
      setToast(`${d.teacherName} (Instructor) has joined.`);
    });
    socket.on('announcement', (a) => setAnnouncements(p => [...p, a]));
    socket.on('you-were-removed', () => { alert("The host has removed you from this session."); onLeave(); });
    
    return () => {
      ['student-admitted', 'student-list-update', 'video-frame', 'chat-message', 'poll-started', 'poll-results-update', 'poll-ended', 'teacher-left', 'announcement', 'you-were-removed'].forEach(e => socket.off(e));
    };
  }, []);

  const toggleHand = () => {
    setMyHand(!myHand);
    socket.emit(myHand ? 'lower-hand' : 'raise-hand');
  };

  return (
    <div className="classroom-dashboard">
       <nav className="nav-bar">
        <div className="nav-brand"><i className="ph-fill ph-brain"></i> ClassMind AI</div>
        <div className="session-info">
          <Badge type="focused">LIVE CLASSROOM</Badge>
          <div className="room-id-container" style={{ margin: 0, padding: '4px 16px', borderRadius: '40px' }}>
            <span className="room-id-text" style={{ fontSize: '1rem' }}>{roomId}</span>
          </div>
        </div>
        <div className="control-group">
          <button className="btn btn-danger btn-sm" onClick={onLeave}><i className="ph ph-phone-disconnect"></i> Leave Session</button>
        </div>
      </nav>

      <div className="dashboard-grid" style={{ gridTemplateColumns: showChat ? '1fr 340px' : '1fr 0px' }}>
        <div className="viewport-center">
          <div className="video-canvas">
            <MyVideoTile 
              username={user.username} 
              role="student" 
              socket={socket} 
              roomId={roomId} 
              audioEnabled={joinSettings?.audioEnabled} 
              videoEnabled={joinSettings?.videoEnabled} 
              onStatusChange={s => socket.emit('engagement-update', { status: s })} 
            />
            {teacher.username && (
              <RemoteTile 
                student={{ ...teacher, status: 'HOST' }} 
                frameData={frames[teacher.socketId]} 
              />
            )}
            {students.filter(s => s.username !== user.username).map(s => (
              <RemoteTile key={s.socketId} student={s} frameData={frames[s.socketId]} />
            ))}
          </div>
        </div>

        {showChat && (
          <InteractionSidebar 
            user={user} 
            messages={messages} 
            socket={socket} 
            students={students} 
            raisedHands={[]} 
            poll={poll} 
            pollResults={pollResults} 
          />
        )}
      </div>

      <div className="control-bar">
        <div className="control-group">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connected as student <b>{user.username}</b></span>
        </div>
        <div className="control-group">
           <button className={`icon-action ${!window._myTileControls?.audio ? 'off' : ''}`} onClick={() => window._myTileControls?.toggleAudio()}><i className={`ph ph-microphone${!window._myTileControls?.audio ? '-slash' : ''}`}></i></button>
           <button className={`icon-action ${!window._myTileControls?.video ? 'off' : ''}`} onClick={() => window._myTileControls?.toggleVideo()}><i className={`ph ph-video-camera${!window._myTileControls?.video ? '-slash' : ''}`}></i></button>
        </div>
        <div className="control-group">
          <button className={`icon-action ${showChat ? 'active' : ''}`} onClick={() => setShowChat(!showChat)} title="Toggle Chat"><i className="ph ph-chat-centered-text"></i></button>
          <ScreenRecorder roomId={roomId} username={user.username} />
          <button className={`icon-action ${myHand ? 'active' : ''}`} onClick={toggleHand} title="Raise Hand"><i className="ph ph-hand-palm"></i></button>
          <button className="icon-action" onClick={() => {}} title="Reactions"><i className="ph ph-smiley"></i></button>
        </div>
      </div>

      <NotificationCenter toast={toast} announcements={announcements} />
    </div>
  );
}

// ══════════════════════════════════════════════════
//  Main Application Orchestrator
// ══════════════════════════════════════════════════
function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoom = urlParams.get('room');
  
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('auth');
  const [roomId, setRoomId] = useState(initialRoom || '');
  const [joinSettings, setJoinSettings] = useState({});
  const [roomData, setRoomData] = useState(null);
  const socketRef = useRef(null);

  const getSocket = () => {
    if (!socketRef.current) socketRef.current = io(window.location.origin, { transports: ['websocket'] });
    return socketRef.current;
  };

  const handleLogin = (u) => {
    setUser(u);
    if (u.role === 'student' && initialRoom) {
      setRoomId(initialRoom); setPage('prejoin');
    } else {
      setPage('lobby');
    }
  };

  const handleJoinClass = (settings) => {
    setJoinSettings(settings);
    const sock = getSocket();
    if (user.role === 'teacher') {
      setPage('classroom');
    } else {
      sock.emit('request-join', { roomId, username: user.username });
      setPage('waiting');
      sock.on('student-admitted', (data) => {
        setRoomData(data);
        setPage('classroom');
      });
      sock.on('admission-denied', () => { alert("Admission denied."); setPage('lobby'); });
    }
  };

  const handleLeave = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setPage('lobby');
  };

  if (page === 'auth') return <AuthPage onLogin={handleLogin} />;
  
  if (page === 'lobby') return user.role === 'teacher' ? 
    <TeacherLobby user={user} onEnterRoom={id => { setRoomId(id); setPage('prejoin'); }} /> : 
    <div className="lobby-layout"><div className="lobby-card glass"><h2 style={{ marginBottom: '24px' }}>Join a Meeting</h2><div className="input-group"><input className="input-field" placeholder="Enter Classroom ID" value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())} /></div><button className="btn btn-primary btn-full" onClick={() => roomId.length === 6 && setPage('prejoin')}>Join Classroom</button></div></div>;

  if (page === 'prejoin') return <PreJoinScreen user={user} roomId={roomId} onJoin={handleJoinClass} onBack={() => setPage('lobby')} />;
  
  if (page === 'waiting') return <div className="lobby-layout"><div className="lobby-card glass"><div className="waiting-spinner" style={{ borderColor: 'var(--border)' }}></div><h2>Waiting for Admission</h2><p style={{ color: 'var(--text-dim)' }}>The instructor will let you in shortly.</p></div></div>;
  
  if (page === 'classroom') {
    const sock = getSocket();
    return user.role === 'teacher' ? 
      <TeacherDashboard user={user} roomId={roomId} socket={sock} onLeave={handleLeave} joinSettings={joinSettings} /> : 
      <StudentDashboard user={user} roomId={roomId} socket={sock} onLeave={handleLeave} joinSettings={joinSettings} admissionData={roomData} />;
  }

  return null;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
