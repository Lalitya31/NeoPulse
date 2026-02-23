# NeoPulse: Holistic Health Platform 🚀

Welcome to the **Holistic Health Platform**, a state-of-the-art hackathon project designed to aggregate, analyze, and proactively manage user wellness using a cutting-edge mix of deep learning and post-quantum cryptography. 

This platform moves beyond basic journaling and symptom tracking by building a secure, emotion-aware intelligence loop. It combines real-time computer vision, graph neural networks (GNNs) for drug interactions, and temporal sequence forecasting with a truly immersive React/WebGL ("Wow Factor") frontend.

---

## 🏗️ Core Architecture & Flow
- **Backend Framework**: Python 3.11 + **FastAPI** (asynchronous, high-performance).
- **Dual Database Strategy**: 
  - **PostgreSQL (via SQLAlchemy)**: The source-of-truth transactional database for Users, Journals, and Medications.
  - **DuckDB**: Embedded analytical engine for fast local OLAP queries (e.g., rolling sentiment calculations, deep correlation analysis between sleep and stress).
- **Authentication**: JWT-based stateless Auth (`oauth2PasswordBearer` + bcrypt). Background medication reminders run via **APScheduler**.

---

## 🧠 The ML Brains (Phase 2 Differentiators)

### 1. Real-time Emotion Detection (`emotion_engine.py`)
A fast, lightweight computer vision engine that works in the background during journaling:
- **How it works:** Uses **MediaPipe** (468 landmarks) to extract 68 specific geometric features per face frame (Eye Aspect Ratio for fatigue, Mouth Aspect Ratio for joy, pitch/yaw/roll, and proxy action units). 
- **The Model:** `1D CNN → BiLSTM → Attention → 7-class Softmax`. Evaluates rolling temporal context and distills an aggregate `stress_score`.
- **Integration (`routers/emotion.py`):** Runs on a fully isolated **WebSocket (`/emotion/ws`)** to prevent cross-user state pollution. Falls back to mock data if no camera is available.

### 2. Post-Quantum Vector RAG (`pqvector_rag.py`)
A retrieval-augmented generation engine designed with extreme medical privacy in mind:
- **Homomorphic Encryption:** Uses **TenSEAL CKKS** so the query embeddings are encrypted, the document database is encrypted, and the vector dot-product similarity search executes *entirely on ciphertext*.
- **Embeddings**: Uses `BAAI/bge-base-en-v1.5` on CUDA (state-of-the-art for clinical retrieval).
- **Tamper-Proof Signatures**: Smashes responses with **Falcon-512** post-quantum signatures, rendering answers completely auditable and immune to algorithmic tampering.
- **Emotion-Aware Prompting:** The RAG automatically scales its tone. If stress > 0.70 via the Emotion WebSocket, the LLM intercepts with a calming breathing induction sequence before answering deep pharmacological questions.

### 3. Drug Interaction GNN (`drug_gnn.py`)
A GraphSAGE engine checking interactions across a dataset of 35 common baseline medications and 45 curated mechanism/clinical edges:
- Does rule-based lookups for speed on known entities, and infers edges dynamically for unknown clinical interactions.
- Severity levels mapped (0=Safe, 1=Caution, 2=Dangerous) alongside deep mechanistic explanations.

### 4. MindCast Forecasting TFT (`mindcast.py`)
A Temporal Fusion Transformer forecasting patient trajectory from heterogeneous temporal inputs (Sleep, Stress, Meds).
- **How it works:** A 7-day retrospective window mapped onto a 3-day forecast horizon.
- Includes a Variable Selection Network to auto-weight which specific signals matter most to the current trajectory. 

---

## 🎨 The "Wow Factor" UI (Phase 3 Frontend)

Because winning a hackathon means blowing away the judges in 3 minutes, the UI is hyper-visual and highly reactive to the backend:

1. **`App.jsx`**: The complete routing shell featuring a secure JWT navigation sidebar. Acts as the data bridge sending the real-time `stress_score` from the web socket to other components. It displays a "High Stress" notification banner automatically if the WebSocket stress score breaches `0.75`.
2. **`HealthOrbit.jsx`**: A jaw-dropping Three.js masterpiece. Renders a 3D solar system with an 1800-star Fibonacci particle field. Your core risk score maps dynamically to the Sun (green = safe, pulsing red = warning). Interactive tooltips guide you around the platform.
3. **`BreathingExercise.jsx`**: A 30-second box breathing demonstration module (4-4-4-4 rhythm). Driven by 2400 WebGL particles. If the backend detects high stress, the particles jitter and scatter chaos; as you inhale to calm down, the color and alignment smooth out synchronously.
4. **`HealthTimeline.jsx`**: A horizontal "Life Tape". Visualizes the journal/mood DuckDB analytics over day/week/month zoom scales and displays real-time Pearson correlation insights on the fly.
5. **`EmotionDetector.jsx`**: A dark, terminal-aesthetic UI widget overlaying your actual webcam feed. Features an animated SVG radar and spring-animated breakdown bars of your current emotional profile.
6. **`DrugInteractionGraph.jsx`**: The Pharmacy Cockpit. A real-time D3.js v7 force-directed network graph. As medications are added/removed via CRUD, the nodes re-arrange, with danger nodes glowing red and exhibiting pulsing SVG rings.

---

## 📁 File Structure Map

```text
/backend/
├── main.py                         # FastAPI setup, CORS, lifespan, auth aliases, and router injection
├── database.py                     # PostgreSQL setup (SQLAlchemy) & DuckDB instantiation 
├── models.py                       # User, Journal (with emotion tags), and Medication DB schemas
├── scheduler.py                    # Background APScheduler instance for Medication reminder crons
├── timeline_endpoint.py            # Generates the DuckDB timelines for HealthTimeline.jsx
│
├── routers/                        # REST Controllers
│   ├── auth.py                     # JWT Token generation, Register/Login endpoints
│   ├── journal.py                  # Whisper audio transcription + RoBERTa sentiment analysis
│   ├── medications.py              # User-specific CRUD routes
│   ├── emotion.py                  # Live WebSocket routing for webcam detection
│   ├── rag.py                      # PQVector RAG routing
│   ├── drugs.py                    # GNN endpoint for interaction graphs
│   └── mindcast.py                 # TFT Forecasting
│
├── emotion_engine.py               # MediaPipe extraction & BiLSTM CNN model (CPU/CUDA)
├── pqvector_rag.py                 # CKKS Encryption, BGE Embeddings, Falcon-512
├── drug_gnn.py                     # GraphSAGE mechanism logic
├── mindcast.py                     # Temporal Fusion Transformer implementation
└── train_emotion_model.py          # CUDA Trainer script for AFFECTNET / RAF-DB
```

```text
/frontend/
├── index.html                      # DOM base (loads D3.js and Three.js global libraries)
└── src/
    ├── App.jsx                     # Root React layout and Global Socket Logic
    └── components/                 # Phase 3 Visual Widgets
        ├── HealthOrbit.jsx
        ├── BreathingExercise.jsx
        ├── HealthTimeline.jsx
        ├── EmotionDetector.jsx
        └── DrugInteractionGraph.jsx
```

---

## 🚀 Running the Project

**1. Install Dependencies**
Activate your Python 3.11 environment. We highly recommend using `venv`:
```bash
python -m venv .venv
# On Windows
.\.venv\Scripts\Activate.ps1
# On Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

**2. Configure Secrets**
Create a `.env` in the `backend/` folder natively if it isn't deployed:
```bash
SECRET_KEY=your-super-secret-jwt-key
DATABASE_URL=postgresql://user:pass@localhost:5432/healthdb
# If Postgres isn't running locally, SQLite fallback works in database.py
```

**3. Launch the Backend Server**
```bash
cd backend
uvicorn main:app --reload
```
The console will verify that your `get_current_user` auth dependencies loaded successfully, the `scheduler` cranked up on thread 1, and the `emotionWS` system is bound to port 8000!

**4. View the App**
Boot up the `index.html` file using your frontend tooling (Vite, Rollup, CRA, or even simple HTTP server if bundled). All routes point cleanly to `http://localhost:8000`.
