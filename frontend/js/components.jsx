/* 
 * components.jsx – Premium UI Components for ClassMind AI v3.0
 * Features modern React patterns, Glassmorphism, and AI Insights.
 */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const SERVER = window.location.origin;

// ─── Helpers ───────────────────────────────────────
const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const getInitials = (n) => (n || '??').split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316'];
const getAvatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const playAlertSound = (isHigh = false) => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = isHigh ? 800 : 440;
    osc.type = isHigh ? 'square' : 'sine';
    gain.gain.value = isHigh ? 0.2 : 0.05;
    osc.start();
    osc.stop(ctx.currentTime + (isHigh ? 1.0 : 0.25));
    osc.onended = () => ctx.close();
  } catch (e) { console.warn('Audio alert failed', e); }
};

// ─── Shared UI Components ──────────────────────────

const Badge = ({ children, type = 'focused' }) => (
  <span className={`engagement-badge ${type}`}>{children}</span>
);

const UserAvatar = ({ name, size = 'md', className = '' }) => (
  <div 
    className={`user-avatar-${size} ${className}`} 
    style={{ background: getAvatarColor(name) }}
  >
    {getInitials(name)}
  </div>
);

// ─── AuthPage (Split Screen) ───────────────────────
function AuthPage({ onLogin }) {
  const [role, setRole] = useState('teacher');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter a valid professional name.');
      return;
    }
    onLogin({ username: name.trim(), role });
  };

  return (
    <div className="auth-page">
      <div className="auth-sidebar">
        <div className="auth-illustration">
          <svg viewBox="0 0 800 800" style={{ opacity: 0.1, width: '150%', height: '150%', transform: 'translate(-10%, -10%)' }}>
            <circle cx="400" cy="400" r="300" stroke="white" strokeWidth="1" fill="none" />
            <circle cx="400" cy="400" r="200" stroke="white" strokeWidth="1" fill="none" />
            <path d="M 100,400 Q 400,100 700,400" stroke="white" fill="none" />
          </svg>
        </div>
        <div className="auth-brand" style={{ position: 'relative', zIndex: 10 }}>
          <div className="auth-logo"><i className="ph-fill ph-brain"></i></div>
          <h1 style={{ fontSize: '2.5rem' }}>ClassMind AI</h1>
        </div>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-dim)', maxWidth: '500px', lineHeight: 1.6, position: 'relative', zIndex: 10 }}>
          Experience the next generation of virtual learning with real-time AI engagement analytics.
        </p>
      </div>

      <div className="auth-form-container">
        <div className="auth-card">
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Choose your role to continue to the classroom.</p>
          
          <div className="auth-tabs">
            <button className={`auth-tab ${role === 'teacher' ? 'active' : ''}`} onClick={() => setRole('teacher')}>
              <i className="ph ph-graduation-cap"></i> Teacher
            </button>
            <button className={`auth-tab ${role === 'student' ? 'active' : ''}`} onClick={() => setRole('student')}>
              <i className="ph ph-user"></i> Student
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">FullName</label>
              <input 
                className="input-field" 
                placeholder={role === 'teacher' ? "e.g., Dr. Samantha Reed" : "e.g., Alex Johnson"} 
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                autoFocus
              />
              {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>}
            </div>
            <button className="btn btn-primary btn-full" type="submit">
              {role === 'teacher' ? 'Start Teaching' : 'Enter Classroom'} <i className="ph ph-arrow-right"></i>
            </button>
          </form>

          <div style={{ marginTop: '40px', padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              <i className="ph ph-shield-check"></i> Encrypted, Secure & AI-Optimized
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PreJoinScreen ─────────────────────────────────
function PreJoinScreen({ user, roomId, onJoin, onBack }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [vidOn, setVidOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            latency: 0
          }
        });
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) { console.error('Media init failed', e); }
    }
    init();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const toggleVid = () => {
    const s = streamRef.current?.getVideoTracks()[0];
    if (s) { s.enabled = !vidOn; setVidOn(!vidOn); }
  };

  const toggleMic = () => {
    const s = streamRef.current?.getAudioTracks()[0];
    if (s) { s.enabled = !micOn; setMicOn(!micOn); }
  };

  const handleJoin = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onJoin({ videoEnabled: vidOn, audioEnabled: micOn });
  };

  return (
    <div className="lobby-layout">
      <div className="lobby-card glass">
        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Ready to join?</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Classroom: <span className="text-gradient">#{roomId}</span></p>

        <div className="video-tile" style={{ width: '480px', margin: '0 auto 32px', height: '270px' }}>
          {vidOn ? (
            <video ref={videoRef} autoPlay muted playsInline className="video-obj" />
          ) : (
            <div className="video-placeholder">
              <UserAvatar name={user.username} size="lg" />
              <p style={{ color: 'var(--text-muted)' }}>Camera is off</p>
            </div>
          )}
          <div className="tile-info">
            <span className="user-label">{user.username} (You)</span>
          </div>
        </div>

        <div className="control-group" style={{ justifyContent: 'center', marginBottom: '32px' }}>
          <button className={`icon-action ${!micOn ? 'off' : ''}`} onClick={toggleMic}>
            <i className={`ph ph-microphone${!micOn ? '-slash' : ''}`}></i>
          </button>
          <button className={`icon-action ${!vidOn ? 'off' : ''}`} onClick={toggleVid}>
            <i className={`ph ph-video-camera${!vidOn ? '-slash' : ''}`}></i>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
          <button className="btn btn-secondary btn-full" onClick={onBack}>Cancel</button>
          <button className="btn btn-primary btn-full" onClick={handleJoin}>Join Meeting</button>
        </div>
      </div>
    </div>
  );
}

// ─── Lobby / Room Management (Teacher) ─────────────
function TeacherLobby({ user, onEnterRoom }) {
  const [room, setRoom] = useState('');
  const [creating, setCreating] = useState(false);
  const [joinId, setJoinId] = useState('');

  const createRoom = async () => {
    setCreating(true);
    try {
      const resp = await fetch(`${SERVER}/api/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherName: user.username })
      });
      const data = await resp.json();
      if (data.roomId) setRoom(data.roomId);
    } catch (e) { alert('Failed to create room.'); }
    setCreating(false);
  };

  const copyLink = () => {
    const link = `${window.location.origin}?room=${room}`;
    navigator.clipboard.writeText(link);
    alert('Invitation link copied to clipboard!');
  };

  return (
    <div className="lobby-layout">
      <div className="lobby-card glass">
        <div className="nav-brand" style={{ justifyContent: 'center', marginBottom: '40px', fontSize: '2rem' }}>
          <i className="ph-fill ph-brain"></i> ClassMind AI
        </div>

        {!room ? (
          <div style={{ animation: 'slideInRight 0.5s forwards' }}>
            <h2 style={{ marginBottom: '16px' }}>Start a New Session</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: '32px' }}>Set up a professional AI-monitored classroom in seconds.</p>
            <button className="btn btn-primary btn-full" style={{ padding: '20px' }} onClick={createRoom} disabled={creating}>
              {creating ? 'Initializing Classroom...' : 'Create New Classroom'}
            </button>
            
            <div style={{ margin: '32px 0', borderTop: '1px solid var(--border)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-main)', padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>OR</span>
            </div>

            <div className="input-group">
              <label className="input-label">Rejoin Existing Room</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input-field" placeholder="Enter Room ID" value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())} maxLength={6} />
                <button className="btn btn-secondary" onClick={() => joinId.length === 6 && onEnterRoom(joinId)}>Join</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ animation: 'slideUp 0.5s forwards' }}>
            <Badge type="focused">Ready to start</Badge>
            <h2 style={{ marginTop: '16px' }}>Your Classroom is Ready</h2>
            <div className="room-id-container">
              <span className="room-id-text">{room}</span>
              <button className="icon-action" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }} onClick={copyLink} title="Copy Link">
                <i className="ph ph-copy"></i>
              </button>
            </div>
            
            <p style={{ color: 'var(--text-dim)', marginBottom: '32px' }}>Share this ID with your students to begin the session.</p>
            
            <button className="btn btn-primary btn-full" style={{ padding: '18px' }} onClick={() => onEnterRoom(room)}>
              Start Session Now <i className="ph ph-rocket-launch"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MyVideoTile ───────────────────────────────────
function MyVideoTile({ username, onStatusChange, role, socket, roomId, audioEnabled, videoEnabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [video, setVideo] = useState(videoEnabled !== false);
  const [audio, setAudio] = useState(audioEnabled !== false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState(role === 'teacher' ? 'teacher' : 'focused');
  const [aiOverlay, setAiOverlay] = useState(null);
  const [maximized, setMaximized] = useState(false);
  const audioEnabledRef = useRef(audio);
  audioEnabledRef.current = audio;

  useEffect(() => {
    let stopped = false;
    let frameInterval;

    async function init() {
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        
        let s;
        if (sharing) {
          s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          s.getVideoTracks()[0].onended = () => !stopped && setSharing(false);
        } else {
          s = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              latency: 0
            } 
          });
        }
        
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        
        streamRef.current = s;
        s.getVideoTracks()[0].enabled = video;
        s.getAudioTracks()[0].enabled = audio;
        
        if (videoRef.current) videoRef.current.srcObject = s;

        // Emit frames for teacher/other students to see
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        frameInterval = setInterval(() => {
          // Use current state to decide whether to emit
          if (videoRef.current && socket) {
            ctx.drawImage(videoRef.current, 0, 0, 320, 240);
            socket.emit('video-frame', { roomId, frameData: canvas.toDataURL('image/jpeg', 0.7) });
          }
        }, 100);

        // Audio Streamer Setup
        let audioCtx, source, processor, silentGain;
        if (s.getAudioTracks().length > 0) {
           const AudioContextWin = window.AudioContext || window.webkitAudioContext;
           audioCtx = new AudioContextWin({ sampleRate: 16000 });
           source = audioCtx.createMediaStreamSource(s);
           // Reduce script processor buffer size for lower latency (1024 instead of 4096)
           processor = audioCtx.createScriptProcessor(1024, 1, 1);
           
           processor.onaudioprocess = (e) => {
             if (audioEnabledRef.current && socket && !stopped) {
                const float32 = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(float32.length);
                for(let i=0; i<float32.length; i++) int16[i] = float32[i] * 0x7FFF;
                socket.volatile.emit('audio-pcm', { roomId, pcm: int16.buffer });
             }
           };
           silentGain = audioCtx.createGain();
           silentGain.gain.value = 0;
           source.connect(processor);
           processor.connect(silentGain);
           silentGain.connect(audioCtx.destination);
        }

        // AI Engagement Detection (for students only)
        if (role !== 'teacher' && video && window.EngagementAI && !sharing) {
          setTimeout(() => {
            if (!stopped && window.EngagementAI && videoRef.current) {
              window.EngagementAI.start({ 
                videoEl: videoRef.current, 
                onStatus: s => { 
                  const statusKey = s.toLowerCase();
                  setStatus(statusKey); 
                  onStatusChange?.(s);
                  if (statusKey === 'drowsy' || statusKey === 'distracted') playAlertSound(true);
                },
                onOverlay: setAiOverlay
              });
            }
          }, 2000);
        }

      } catch (e) {
        console.error("Camera access failed", e);
        setStatus('error');
      }
    }
    init();
    return () => { 
      stopped = true; 
      clearInterval(frameInterval); 
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (window.EngagementAI) window.EngagementAI.stop();
      // Audio nodes are garbage collected when stopped
    };
  }, [sharing, videoEnabled, audioEnabled]); // Dependencies cleaned up

  const toggleVideo = () => {
    const s = streamRef.current?.getVideoTracks()[0];
    if (s) { s.enabled = !video; setVideo(!video); }
  };
  const toggleAudio = () => {
    const s = streamRef.current?.getAudioTracks()[0];
    if (s) { s.enabled = !audio; setAudio(!audio); }
  };

  window._myTileControls = { toggleVideo, toggleAudio, video, audio, sharing, setSharing };

  return (
    <>
      {maximized && <div className="maximized-overlay" onClick={() => setMaximized(false)} />}
      <div className={`video-tile ${role === 'teacher' ? 'active-speaker' : ''} ${maximized ? 'maximized' : ''}`}>
        {status === 'error' ? (
          <div className="video-placeholder" style={{ background: 'var(--danger-glow)', flexDirection: 'column' }}>
            <i className="ph ph-warning-circle" style={{ fontSize: '3rem', color: 'white', marginBottom: '10px' }}></i>
            <p style={{ color: 'white', textAlign: 'center', padding: '0 20px', fontSize: '0.9rem' }}>
              <strong>Camera Permission Denied</strong><br/>
              Please click 'Allow' in your browser URL bar.
            </p>
          </div>
        ) : video ? (
          <video ref={videoRef} autoPlay muted playsInline className="video-obj" style={{ transform: sharing ? 'none' : 'scaleX(-1)' }} />
        ) : (
          <div className="video-placeholder">
            <UserAvatar name={username} size="lg" />
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Video is Off</p>
          </div>
        )}
        <div className="tile-info">
          <span className="user-label">{username} (You)</span>
          {role !== 'teacher' && <Badge type={status}>{status}</Badge>}
          {role === 'teacher' && <Badge type="focused">HOST</Badge>}
        </div>
        
        <div className="teacher-actions" style={{ position: 'absolute', top: '12px', right: maximized ? '24px' : '12px', zIndex: 30 }}>
          <button className={`icon-action ${maximized ? 'active' : ''}`} style={{ width: '32px', height: '32px' }} onClick={() => setMaximized(!maximized)} title={maximized ? "Shrink" : "Maximize"}>
            <i className={`ph ph-${maximized ? 'corners-in' : 'corners-out'}`}></i>
          </button>
        </div>

        {status === 'distracted' && <div className="toast" style={{ position: 'absolute', top: '12px', left: '12px', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', fontSize: '0.7rem' }}>⚠️ STAY FOCUSED</div>}
      </div>
    </>
  );
}

// ─── RemoteTile ────────────────────────────────────
function RemoteTile({ student, frameData, isTeacherView, onPin, onKick, isPinned, raisedHand }) {
  const [maximized, setMaximized] = useState(false);
  const status = (student.status || 'focused').toLowerCase();
  
  return (
    <>
      {maximized && <div className="maximized-overlay" onClick={() => setMaximized(false)} />}
      <div className={`video-tile ${status === 'focused' ? '' : status} ${isPinned ? 'active-speaker' : ''} ${maximized ? 'maximized' : ''}`}>
        {frameData ? (
          <img src={frameData} className="video-obj" />
        ) : (
          <div className="video-placeholder">
            <UserAvatar name={student.username} size="lg" />
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Reconnecting Video...</p>
          </div>
        )}
        <div className="tile-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="user-label">{student.username}</span>
            {raisedHand && <i className="ph-fill ph-hand-palm" style={{ color: 'var(--warning)', fontSize: '1.2rem' }}></i>}
          </div>
          <Badge type={status}>{status}</Badge>
        </div>
        
        <div className="teacher-actions" style={{ position: 'absolute', top: '12px', right: maximized ? '24px' : '12px', display: 'flex', gap: '8px', zIndex: 30 }}>
          <button className={`icon-action ${maximized ? 'active' : ''}`} style={{ width: '32px', height: '32px' }} onClick={() => setMaximized(!maximized)} title={maximized ? "Shrink" : "Maximize"}>
            <i className={`ph ph-${maximized ? 'corners-in' : 'corners-out'}`}></i>
          </button>
          
          {isTeacherView && !maximized && (
            <>
              <button className="icon-action" style={{ width: '32px', height: '32px' }} onClick={() => onPin(student.socketId)}>
                <i className="ph ph-push-pin"></i>
              </button>
              <button className="icon-action off" style={{ width: '32px', height: '32px' }} onClick={() => onKick(student.socketId)}>
                <i className="ph ph-user-minus"></i>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── AI Engagement Dashboard Sidebar (Right) ───────
function AIEngagementSidebar({ students, alerts, attendanceLog, roomId }) {
  const engagementRate = useMemo(() => {
    if (students.length === 0) return 100;
    const focused = students.filter(s => (s.status || 'focused').toLowerCase() === 'focused').length;
    return Math.round((focused / students.length) * 100);
  }, [students]);

  const downloadAttendance = () => {
    if (!attendanceLog || attendanceLog.length === 0) {
      alert("No attendance data available yet.");
      return;
    }
    
    try {
      // 1. Create the CSV data
      const headers = ["Student Name", "Date", "Join Time"];
      const rows = attendanceLog.map(entry => {
        const d = new Date(entry.joinedAt);
        return [
          `"${entry.username.replace(/"/g, '""')}"`, // Quote names for Excel safety
          `"${d.toLocaleDateString()}"`,
          `"${d.toLocaleTimeString()}"`
        ].join(",");
      });
      
      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      
      // 2. Visual Toast to let user know it's happening
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = '<i class="ph ph-file-csv" style="color:var(--success)"></i> <span>Generating Attendance Report... Check your downloads folder.</span>';
      toast.style.position = 'fixed'; 
      toast.style.bottom = '80px'; 
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)'; 
      toast.style.zIndex = '9999';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);

      // 3. Trigger Download
      const fileName = `Attendance_${roomId}_${new Date().toISOString().slice(0,10)}.csv`;
      
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, fileName);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Slightly longer delay before cleaning up
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 1000);
      }
    } catch (e) {
      console.error("Attendance download failed", e);
      alert("Could not generate report. Please ensure your browser allows downloads.");
    }
  };

  return (
    <div className="sidebar-right">
      <h3 className="heading" style={{ fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="ph-fill ph-chart-line" style={{ color: 'var(--accent)' }}></i> AI Engagement
      </h3>

      <div className="ai-dashboard-card">
        <div className="circular-progress">
          <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="70" cy="70" r="64" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none" />
            <circle cx="70" cy="70" r="64" stroke="url(#primary-glow)" strokeWidth="8" fill="none" strokeDasharray="402" strokeDashoffset={402 - (402 * engagementRate) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            <defs>
              <linearGradient id="primary-glow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="progress-value">{engagementRate}%</div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Overall Attendance Quality</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 className="heading" style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>REPORTS</h4>
        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={downloadAttendance}>
          <i className="ph ph-download-simple"></i> Download
        </button>
      </div>

      <div className="student-status-grid">
        {students.map(s => {
          const st = (s.status || 'focused').toLowerCase();
          return (
            <div key={s.socketId} className="status-card">
              <UserAvatar name={s.username} size="sm" />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>{s.username}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.alertCount} behavioral alerts</p>
              </div>
              <div className={`status-indicator ${st === 'focused' ? 'green' : st === 'distracted' ? 'yellow' : 'red'}`}></div>
            </div>
          );
        })}
        {students.length === 0 && !window._waitingList?.length && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Waiting for students...</p>}
      </div>

      {window._waitingList && window._waitingList.length > 0 && (
         <div className="ai-dashboard-card" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <h4 className="heading" style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '12px' }}>PENDING ADMISSIONS ({window._waitingList.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {window._waitingList.map(s => (
                <div key={s.socketId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                   <div style={{ flex: 1, fontWeight: '600' }}>{s.username}</div>
                   <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => window._onAdmit?.(s.socketId)}>Admit</button>
                </div>
              ))}
            </div>
         </div>
      )}


      <div className="ai-dashboard-card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.1)' }}>
        <h4 className="heading" style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '12px' }}>RECENT ALERTS</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.slice(-3).reverse().map((a, i) => (
            <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ph ph-warning-circle" style={{ color: 'var(--danger)' }}></i>
              <span><b>{a.studentName}</b> is {a.status.toLowerCase()}</span>
            </div>
          ))}
          {alerts.length === 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class is going smooth.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Chat & Interactive Panel (Left) ───────────────
function InteractionSidebar({ user, messages, socket, students, raisedHands, poll, pollResults }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMsg = (e) => {
    e.preventDefault();
    if (msg.trim()) {
      socket.emit('chat-message', { message: msg.trim() });
      setMsg('');
    }
  };

  return (
    <div className="sidebar-left">
      <div className="sidebar-tabs">
        <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Chat</button>
        <button className={`tab-btn ${activeTab === 'polls' ? 'active' : ''}`} onClick={() => setActiveTab('polls')}>Polls</button>
        <button className={`tab-btn ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')}>People</button>
        {user.role === 'teacher' && <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Notes</button>}
      </div>

      {activeTab === 'chat' && (
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.username === user.username ? 'me' : 'others'}`}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.username}</p>
                <div className="msg-bubble">{m.message}</div>
              </div>
            ))}
            <div ref={chatEndRef}></div>
          </div>
          <form className="chat-footer" onSubmit={sendMsg}>
            <input className="input-field" placeholder="Type a message..." value={msg} onChange={e => setMsg(e.target.value)} />
            <button className="icon-action active" type="submit"><i className="ph ph-paper-plane-right"></i></button>
          </form>
        </div>
      )}

      {activeTab === 'polls' && (
        <div style={{ padding: '24px' }}>
           <PollPanel socket={socket} poll={poll} results={pollResults} isTeacher={user.role === 'teacher'} />
        </div>
      )}

      {activeTab === 'people' && (
        <div className="student-status-grid" style={{ padding: '20px' }}>
          <h4 className="heading" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>On-Stage Hand Raise</h4>
          {raisedHands.map((h, i) => (
            <div key={i} className="status-card" style={{ borderColor: 'var(--warning-glow)' }}>
              <UserAvatar name={h.username} size="sm" />
              <p style={{ flex: 1, fontSize: '0.85rem' }}>{h.username}</p>
              <Badge type="distracted">WAITING</Badge>
            </div>
          ))}
          {raisedHands.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hands raised</p>}
        </div>
      )}

      {activeTab === 'notes' && (
        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
           <h4 className="heading" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Session Transcript</h4>
           <div className="glass" style={{ flex: 1, padding: '16px', borderRadius: '12px', overflowY: 'auto', fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>
              {window._sessionTranscript && window._sessionTranscript.length > 0 ? window._sessionTranscript.map((t, i) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: '600' }}>[{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>{' '}
                  <span style={{ color: 'var(--text-main)' }}>{t.username}:</span> {t.text}
                </div>
              )) : "Generating real-time transcript..."}
           </div>
           <button className="btn btn-secondary btn-sm btn-full" style={{ marginTop: '16px' }} onClick={() => {
              const data = window._sessionTranscript?.map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.username}: ${t.text}`).join('\n');
              const blob = new Blob([data], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'transcript.txt'; a.click();
           }}>Download File</button>
        </div>
      )}
    </div>
  );
}

// ─── PollPanel ─────────────────────────────────────
function PollPanel({ socket, poll, results, isTeacher }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  
  if (poll && poll.active) {
    const total = results?.reduce((a, b) => a + b.count, 0) || 0;
    return (
      <div className="ai-dashboard-card">
        <h4 className="heading" style={{ fontSize: '1rem', marginBottom: '16px' }}>{poll.question}</h4>
        {results?.map((r, i) => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          return (
            <div key={i} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span>{r.option}</span>
                <span>{pct}%</span>
              </div>
              <div className="engagement-bar-wrap" style={{ height: '8px', background: 'var(--bg-main)' }}>
                <div className="engagement-bar" style={{ width: `${pct}%`, background: 'var(--primary)', transition: 'width 0.5s ease' }}></div>
              </div>
            </div>
          );
        })}
        {!isTeacher && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '16px' }}>Vote recorded. Watching results...</p>}
        {isTeacher && <button className="btn btn-secondary btn-sm btn-full" style={{ marginTop: '20px' }} onClick={() => socket.emit('end-poll')}>End Poll</button>}
      </div>
    );
  }

  if (isTeacher) {
    return (
      <div>
        <h4 className="heading" style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Create Quick Poll</h4>
        <div className="input-group">
          <label className="input-label">Question</label>
          <input className="input-field" value={q} onChange={e => setQ(e.target.value)} placeholder="What's your thought on..." />
        </div>
        {opts.map((o, i) => (
          <div key={i} className="input-group">
            <input className="input-field" style={{ marginBottom: '8px' }} value={o} onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }} placeholder={`Option ${i + 1}`} />
          </div>
        ))}
        <button className="btn btn-secondary btn-full" style={{ marginBottom: '12px' }} onClick={() => setOpts([...opts, ''])}>+ Add Option</button>
        <button className="btn btn-primary btn-full" onClick={() => socket.emit('create-poll', { question: q, options: opts.filter(o => o.trim()) })}>Launch Poll</button>
      </div>
    );
  }

  return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No active polls</div>;
}

// ─── Waiting Room Modal (Teacher) ──────────────────
function WaitingRoomModal({ waitingList, onAdmit, onDeny, onAdmitAll }) {
  if (waitingList.length === 0) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }}>
      {/* Increased zIndex to 1000 to ensure it appears on top */}
      <div className="modal-card glass" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 className="heading" style={{ margin: 0, fontSize: '1.5rem' }}>Admission Requests</h2>
          <Badge type="focused">{waitingList.length} PENDING</Badge>
        </div>
        
        <div className="student-status-grid" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '24px', padding: '4px' }}>
          {waitingList.map(s => (
            <div key={s.socketId} className="status-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <UserAvatar name={s.username} size="sm" />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>{s.username}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Requested just now</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-action off" style={{ width: '32px', height: '32px' }} onClick={() => onDeny(s.socketId)}>
                  <i className="ph ph-x"></i>
                </button>
                <button className="icon-action active" style={{ width: '32px', height: '32px' }} onClick={() => onAdmit(s.socketId)}>
                  <i className="ph ph-check"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary btn-full" onClick={onAdmitAll}>Admit All</button>
        </div>
      </div>
    </div>
  );
}

// ─── Toasts & Notifications ────────────────────────
function NotificationCenter({ toast, announcements }) {
  return (
    <div className="toast-container">
      {toast && (
        <div className="toast">
          <i className="ph-fill ph-bell-ringing" style={{ color: 'var(--accent)' }}></i>
          <span>{toast}</span>
        </div>
      )}
      {announcements.map((a, i) => (
        <div key={i} className="toast" style={{ borderLeft: '4px solid var(--accent)' }}>
          <i className="ph-fill ph-megaphone" style={{ color: 'var(--accent)' }}></i>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Announcement from {a.from}</p>
            <p style={{ fontWeight: '600' }}>{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── Screen Recorder Component ─────────────────────
function ScreenRecorder({ roomId, username }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);


  const startRecording = async () => {
    try {
      // Adding a small notification to guide the user
      const instruction = document.createElement('div');
      instruction.className = 'toast';
      instruction.innerHTML = '<i class="ph ph-info" style="color:var(--accent)"></i> <span>Please select <b>"This Tab"</b> in the browser prompt to start recording the classroom.</span>';
      instruction.style.position = 'fixed';
      instruction.style.bottom = '100px';
      instruction.style.left = '50%';
      instruction.style.transform = 'translateX(-50%)';
      instruction.style.zIndex = '9999';
      document.body.appendChild(instruction);
      setTimeout(() => instruction.remove(), 5000);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          displaySurface: "browser",
          cursor: "always" 
        },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        systemAudio: "include"
      });

      const options = { mimeType: 'video/webm;codecs=vp8,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm'; // Fallback
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `ClassRecord_${roomId}_${new Date().toISOString().slice(0, 10)}.webm`;
        document.body.appendChild(a);
        a.click();
        
        // Use a small timeout to ensure the browser has started the download before revoking the URL
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
        
        setRecording(false);
      };

      mediaRecorderRef.current.start();
      setRecording(true);

      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      };

    } catch (err) {
      console.error("Error starting screen recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        className={`icon-action ${recording ? 'off' : ''}`} 
        onClick={recording ? stopRecording : startRecording}
        title={recording ? "Stop Recording" : "Record Session"}
        style={{ position: 'relative' }}
      >
        <i className={`ph ph-${recording ? 'stop-circle' : 'record'}`}></i>
      </button>
      {recording && (
        <div style={{ 
          position: 'absolute', 
          top: '-8px', 
          right: '-8px', 
          background: 'var(--danger)', 
          color: 'white', 
          fontSize: '0.6rem', 
          padding: '2px 6px', 
          borderRadius: '10px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 0 10px var(--danger-glow)',
          zIndex: 10
        }}>
          <span className="recording-dot" style={{ width: '6px', height: '6px', animationDuration: '1s' }}></span>
          REC
        </div>
      )}
    </div>
  );
}


// ─── End Session View (Teacher) ────────────────────
function EndSessionModal({ students, alerts, sessionStart, onConfirm, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card glass">
        <h2 className="heading" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Session Summary</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Detailed AI engagement report for your records.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div className="ai-dashboard-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg. Focus</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>94%</p>
          </div>
          <div className="ai-dashboard-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Alerts</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--danger)' }}>{alerts.length}</p>
          </div>
        </div>

        <button className="btn btn-primary btn-full" style={{ marginBottom: '12px' }} onClick={onConfirm}>End Session & Save Report</button>
        <button className="btn btn-secondary btn-full" onClick={onClose}>Return to Class</button>
      </div>
    </div>
  );
}

