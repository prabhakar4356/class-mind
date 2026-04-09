import cv2
import mediapipe as mp
import time
import numpy as np

# ─────────────────────────────────────────────────────────────────────────
# EXPERT ENGAGEMENT DETECTION SYSTEM (V2.0)
# Features: Temporal Smoothing, Adaptive Calibration, Alert Cooldown
# ─────────────────────────────────────────────────────────────────────────

class EngagementAI:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # --- Parameter Tuning Section ---
        self.EAR_THRESHOLD = 0.22      # Initial threshold (adaptive calibration updates this)
        self.SMOOTHING_WINDOW = 10     # Rolling average window size
        self.BLINK_MAX_SEC = 0.5       # Max duration for a blink
        self.DROWSY_MIN_SEC = 5.0      # Trigger after 5s of closed eyes
        self.DISTRACT_MIN_SEC = 2.0    # Trigger after 2s of looking away
        self.COOLDOWN_SEC = 5.0        # Avoid double-beeping
        
        # --- State Variables ---
        self.ear_history = []
        self.eye_closed_start = None
        self.distract_start = None
        self.last_alert_time = 0
        self.calibration_ears = []
        self.is_calibrated = False

    def calculate_ear(self, landmarks, eye_indices):
        """Compute Eye Aspect Ratio (EAR)"""
        # Vertical distances
        p2_p6 = np.linalg.norm(np.array([landmarks[eye_indices[1]].x, landmarks[eye_indices[1]].y]) - 
                               np.array([landmarks[eye_indices[5]].x, landmarks[eye_indices[5]].y]))
        p3_p5 = np.linalg.norm(np.array([landmarks[eye_indices[2]].x, landmarks[eye_indices[2]].y]) - 
                               np.array([landmarks[eye_indices[4]].x, landmarks[eye_indices[4]].y]))
        # Horizontal distance
        p1_p4 = np.linalg.norm(np.array([landmarks[eye_indices[0]].x, landmarks[eye_indices[0]].y]) - 
                               np.array([landmarks[eye_indices[3]].x, landmarks[eye_indices[3]].y]))
        
        return (p2_p6 + p3_p5) / (2.0 * p1_p4)

    def get_status(self, ear, yaw, pitch):
        """Core logic implementing blink differentiation and multi-factor validation"""
        now = time.time()
        status = "Focused"
        alert_needed = False

        # 1. Temporal Smoothing
        self.ear_history.append(ear)
        if len(self.ear_history) > self.SMOOTHING_WINDOW:
            self.ear_history.pop(0)
        smoothed_ear = sum(self.ear_history) / len(self.ear_history)

        # 2. Adaptive Calibration (first 100 frames)
        if not self.is_calibrated:
            self.calibration_ears.append(smoothed_ear)
            if len(self.calibration_ears) > 100:
                self.EAR_THRESHOLD = np.mean(self.calibration_ears) * 0.75
                self.is_calibrated = True
            return "Calibrating", False

        # 3. Validation Logic
        is_eyes_closed = smoothed_ear < self.EAR_THRESHOLD
        is_looking_away = abs(yaw) > 0.25 or abs(pitch) > 0.20

        # Eye Duration Logic
        if is_eyes_closed:
            if self.eye_closed_start is None:
                self.eye_closed_start = now
            duration = now - self.eye_closed_start
            
            if duration > self.DROWSY_MIN_SEC:
                status = "DROWSY"
                alert_needed = True
            elif duration > self.BLINK_MAX_SEC:
                status = "Eyes Closed"
            else:
                status = "Blinking"
        else:
            self.eye_closed_start = None

        # Distraction Logic
        if is_looking_away:
            if self.distract_start is None:
                self.distract_start = now
            if (now - self.distract_start) > self.DISTRACT_MIN_SEC:
                status = "DISTRACTED"
                alert_needed = True
        else:
            self.distract_start = None

        # Cooldown check
        if alert_needed and (now - self.last_alert_time) < self.COOLDOWN_SEC:
            alert_needed = False
        elif alert_needed:
            self.last_alert_time = now

        return status, alert_needed

def main():
    cap = cv2.VideoCapture(0)
    detector = EngagementAI()
    
    # MediaPipe Indices for EAR
    LEFT_EYE = [362, 385, 387, 263, 373, 380]
    RIGHT_EYE = [33, 160, 158, 133, 153, 144]

    while cap.isOpened():
        success, image = cap.read()
        if not success: break

        image = cv2.flip(image, 1)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = detector.face_mesh.process(rgb_image)

        if results.multi_face_landmarks:
            lm = results.multi_face_landmarks[0].landmark
            ear_l = detector.calculate_ear(lm, LEFT_EYE)
            ear_r = detector.calculate_ear(lm, RIGHT_EYE)
            ear = (ear_l + ear_r) / 2.0
            
            # Simplified Pose (Nose tip pos)
            yaw = lm[1].x - 0.5
            pitch = lm[1].y - 0.5

            status, alert = detector.get_status(ear, yaw, pitch)

            # Debug Mode Display
            color = (0, 255, 0) if status == "Focused" else (0, 0, 255)
            cv2.putText(image, f"Status: {status}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            cv2.putText(image, f"EAR: {ear:.3f}", (30, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1)
            cv2.putText(image, f"Threshold: {detector.EAR_THRESHOLD:.3f}", (30, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 1)
            
            if alert:
                cv2.putText(image, "!!! ALERT !!!", (30, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)

        cv2.imshow('Expert Engagement AI', image)
        if cv2.waitKey(5) & 0xFF == 27: break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
