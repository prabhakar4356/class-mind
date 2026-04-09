# ClassMind AI – Online Classroom Platform

## 🚀 Quick Start (Local)

### Step 1: Install All Dependencies
Run this from the **root** folder:
```bash
npm install
```

### Step 2: Start the Server
```bash
npm start
```
> Server starts on **http://localhost:5000**  
> The frontend is served automatically from the same URL.

---

## 🌐 Deployment (Cloud)

The project is now pre-configured for one-click deployment to **Render**, **Railway**, or **Heroku**.

### Option 1: Render.com (Recommended)
1. Link your GitHub repository to [Render](https://render.com).
2. Create a new **Web Service**.
3. Use the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Render will automatically detect the root `package.json` and deploy.

### Option 2: Heroku
1. Install the Heroku CLI and run `heroku create`.
2. The included `Procfile` will automatically tell Heroku to start the backend server.
3. Push your code: `git push heroku main`.

> [!IMPORTANT]
> **Camera Permissions**: Browsers require **HTTPS** to access the camera. Both Render and Heroku provide SSL (HTTPS) automatically for your deployed site.

---

## 📂 Project Structure

```
online_classroom_platform/
├── backend/
│   ├── server.js          # Express + Socket.IO server
│   └── package.json
└── frontend/
    ├── index.html         # App shell (React via CDN)
    ├── style.css          # Full design system
    └── js/
        ├── App.jsx        # Full React SPA (all pages + components)
        └── engagementAI.js # MediaPipe AI engagement detection
```

---

## 🔄 Workflow

```
Teacher Login → Create Room (6-char ID) → Share ID with students
Student Login → Enter Room ID           → Join class

Both enter Classroom:
  ├── Teacher sees: student grid, engagement stats, alerts panel, chat
  └── Student sees: live camera (AI running), classmates, chat

AI Detection (runs in student browser via MediaPipe):
  1. Eye Aspect Ratio (EAR) < 0.22 for 15+ frames → Drowsy
  2. Head Yaw > 0.20 or Pitch > 0.18              → Distracted
  3. No face detected                              → Distracted

On Alert:
  ├── Student: Browser beep sound plays (after 5s)
  └── Teacher: Real-time "⚠️ [Name] is Distracted/Drowsy" notification
```

---

## 🎓 Viva Q&A

**Q1: How is engagement detected?**  
MediaPipe Face Mesh extracts 468 facial landmarks. We compute:
- **EAR (Eye Aspect Ratio)**: measures eye openness. EAR < 0.22 for 15+ frames = drowsy.
- **Head Pose**: nose tip vs face centre determines yaw (left/right) and pitch (up/down).
- If yaw > 20% or pitch > 18% → Distracted.

**Q2: How do real-time alerts reach the teacher?**  
Socket.IO bi-directional websocket: Student → `engagement-update` event → Server → `teacher-alert` event → Teacher dashboard. Latency < 100ms on LAN.

**Q3: Why client-side AI?**  
Running MediaPipe in the browser via CDN means no GPU server needed. Works on normal laptops. No video leaves the device (privacy-preserving).

**Q4: What's the tech stack?**  
- Frontend: React 18 (CDN), Vanilla CSS, Socket.IO client, MediaPipe Face Mesh
- Backend: Node.js + Express v5 + Socket.IO v4
- Real-time: WebSockets (Socket.IO)
- AI: MediaPipe Face Mesh (browser WASM)

---

## 🎁 Bonus Features Implemented
- ✅ Live Chat system
- ✅ Raise Hand feature (✋ button → teacher notification)
- ✅ Engagement Rate % bar chart per session
- ✅ Student alert count tracking
- ✅ Teacher alert history panel
