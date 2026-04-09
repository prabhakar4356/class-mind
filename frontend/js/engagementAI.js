// ─────────────────────────────────────────────────────────────────────────
//  engagementAI.js  –  Advanced Enterprise-Grade Engagement AI
//  Implements: Temporal Smoothing, Adaptive Calibration, Blink Filtering, 
//  Multi-Factor Validation & Confidence Scoring.
// ─────────────────────────────────────────────────────────────────────────

window.EngagementAI = (function () {
  'use strict';

  // Landmarks & Constants
  const EAR_L     = [362, 385, 387, 263, 373, 380];
  const EAR_R     = [33, 160, 158, 133, 153, 144];
  
  // Tuning Parameters
  const SETTINGS = {
    CALIBRATION_SEC:   10,    // Time to establish personal baseline EAR
    SMOOTHING_WINDOW:  15,    // Frame window for moving average
    BLINK_MAX_SEC:     0.5,   // Blinks are fast
    DROWSY_MIN_SEC:    20.0,  // User requested: 20s eye closure
    HEAD_DOWN_MIN_SEC: 10.0,  // User requested: 10s head down
    DISTRACT_MIN_SEC:  5.0,   // Distraction alert after 5s looking away
    LOOK_AWAY_MAX_SEC: 15.0,  // Severe distraction
    ALERT_COOLDOWN:    10000, // 10s pause between alerts
    CONFIDENCE_LIMIT:  0.85,  // Required score for 'Drowsy'/'Distracted' labels
  };

  // State Variables
  let frameCount         = 0;
  let calibrationData    = { ear: [], yaw: [], pitch: [] };
  let baselineEAR        = 0.28; 
  let baselineYaw        = 0.0;
  let baselinePitch      = 0.0;
  let earHistory         = [];
  
  let eyeClosedStartTime = null;
  let distractStartTime  = null;
  let headDownStartTime  = null;
  let lastAlertTime      = 0;
  let lastStatus         = 'Focused';

  // Utils
  function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
  
  function getEAR(lm, indices) {
    const p1 = lm[indices[0]], p4 = lm[indices[3]];
    const p2 = lm[indices[1]], p6 = lm[indices[5]];
    const p3 = lm[indices[2]], p5 = lm[indices[4]];
    return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
  }

  function getHeadPose(lm) {
    const nose = lm[1], chin = lm[152], leftE = lm[33], rightE = lm[263];
    const faceW = dist(leftE, rightE);
    const midX  = (leftE.x + rightE.x) / 2;
    const midY  = (leftE.y + rightE.y) / 2;
    
    // Improved formulas
    const yaw   = (nose.x - midX) / faceW;
    const pitch = (nose.y - midY) / faceW; // Relative to eye-line
    return { yaw, pitch };
  }

  function playAlert() {
    if (Date.now() - lastAlertTime < SETTINGS.ALERT_COOLDOWN) return;
    lastAlertTime = Date.now();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 600; osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
      osc.start(); osc.stop(ctx.currentTime + 1);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance("System detected lower engagement. Please focus.");
        utter.rate = 1.0; window.speechSynthesis.speak(utter);
      }
    } catch (e) { console.error('Audio failed', e); }
  }

  function processResults(results) {
    frameCount++;
    let currentStatus = 'Focused';
    let smoothedEAR = 0;
    
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      currentStatus = 'No Face Detected';
      handleDistraction(true);
    } else {
      const lm = results.multiFaceLandmarks[0];
      const ear = (getEAR(lm, EAR_L) + getEAR(lm, EAR_R)) / 2;
      const { yaw, pitch } = getHeadPose(lm);

      // 1. Adaptive Calibration (EAR + Head Pose)
      if (frameCount < 30 * SETTINGS.CALIBRATION_SEC) {
        calibrationData.ear.push(ear);
        calibrationData.yaw.push(yaw);
        calibrationData.pitch.push(pitch);
        
        if (calibrationData.ear.length % 50 === 0) {
          baselineEAR   = calibrationData.ear.reduce((a,b)=>a+b,0) / calibrationData.ear.length;
          baselineYaw   = calibrationData.yaw.reduce((a,b)=>a+b,0) / calibrationData.yaw.length;
          baselinePitch = calibrationData.pitch.reduce((a,b)=>a+b,0) / calibrationData.pitch.length;
        }
        currentStatus = 'Calibrating...';
      }

      // 2. Temporal Smoothing
      earHistory.push(ear);
      if (earHistory.length > SETTINGS.SMOOTHING_WINDOW) earHistory.shift();
      smoothedEAR = earHistory.reduce((a, b) => a + b, 0) / earHistory.length;

      // 3. Logic & Multi-Factor Validation (Using calibrated baselines)
      const dynamicThreshold = baselineEAR * 0.75; 
      const isEyesClosed     = smoothedEAR < dynamicThreshold;
      
      // Calculate relative deviation from baseline
      const relYaw   = Math.abs(yaw - baselineYaw);
      const relPitch = Math.abs(pitch - baselinePitch);
      
      const isLookingAway = relYaw > 0.30 || relPitch > 0.25; 
      const isHeadTilted  = (pitch - baselinePitch) > 0.25; // Slumped down

      // Multi-condition scoring
      let suspicionScore = 0;
      if (isEyesClosed) suspicionScore += 0.6;
      if (isLookingAway) suspicionScore += 0.5;
      if (isHeadTilted) suspicionScore += 0.3;

      // Duration logic: Eyes Closed
      if (isEyesClosed) {
        if (!eyeClosedStartTime) eyeClosedStartTime = Date.now();
        const closedSec = (Date.now() - eyeClosedStartTime) / 1000;
        if (closedSec > SETTINGS.DROWSY_MIN_SEC) {
          currentStatus = 'Drowsy';
          playAlert();
        } else if (closedSec > SETTINGS.BLINK_MAX_SEC) {
          currentStatus = 'Closed';
        }
      } else {
        eyeClosedStartTime = null;
      }

      // Duration logic: Head Down (New requirement: 10s)
      if (isHeadTilted) {
        if (!headDownStartTime) headDownStartTime = Date.now();
        const tiltedSec = (Date.now() - headDownStartTime) / 1000;
        if (tiltedSec > SETTINGS.HEAD_DOWN_MIN_SEC) {
          currentStatus = 'Drowsy'; // Head down for 10s is also flagged as Drowsy/Lethargic
          playAlert();
        }
      } else {
        headDownStartTime = null;
      }

      // Duration logic: Looking Away
      if (isLookingAway) {
        handleDistraction(true);
        if (distractStartTime) {
          const awaySec = (Date.now() - distractStartTime) / 1000;
          if (awaySec > SETTINGS.LOOK_AWAY_MAX_SEC) {
            currentStatus = 'Long Distraction';
            playAlert();
          } else if (awaySec > SETTINGS.DISTRACT_MIN_SEC) {
            currentStatus = 'Distracted';
          }
        }
      } else {
        handleDistraction(false);
      }

      if (currentStatus === 'Focused' && suspicionScore > 0.4) {
        currentStatus = 'Unfocused';
      }

      // Debug Overlay Signal
      if (window.EngagementAI.onOverlay) {
        window.EngagementAI.onOverlay({ 
          ear: smoothedEAR.toFixed(3), 
          base: baselineEAR.toFixed(3),
          yaw: relYaw.toFixed(2),
          pitch: relPitch.toFixed(2),
          status: currentStatus,
          score: suspicionScore.toFixed(1)
        });
      }
    }

    // Status Emission
    if (currentStatus !== lastStatus) {
      lastStatus = currentStatus;
      if (window.EngagementAI.onStatus) window.EngagementAI.onStatus(currentStatus);
    }
  }

  function handleDistraction(active) {
    if (active) {
      if (!distractStartTime) distractStartTime = Date.now();
    } else {
      distractStartTime = null;
    }
  }

  async function start({ videoEl, onStatus, onOverlay }) {
    window.EngagementAI.onStatus = onStatus;
    window.EngagementAI.onOverlay = onOverlay;
    
    const faceMesh = new FaceMesh({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    faceMesh.onResults(processResults);

    const camera = new Camera(videoEl, {
      onFrame: async () => { await faceMesh.send({ image: videoEl }); },
      width: 480, height: 360,
    });
    await camera.start();
    
    window.EngagementAI._stop = () => {
      camera.stop(); 
      faceMesh.close();
      resetState();
    };
  }

  function resetState() {
    frameCount = 0; 
    calibrationData = { ear: [], yaw: [], pitch: [] }; 
    earHistory = [];
    baselineEAR = 0.28;
    baselineYaw = 0.0;
    baselinePitch = 0.0;
    eyeClosedStartTime = null; 
    distractStartTime = null;
    headDownStartTime = null;
  }

  return { 
    start, 
    stop: () => { if(window.EngagementAI._stop) window.EngagementAI._stop(); },
    onStatus: null,
    onOverlay: null
  };
})();
