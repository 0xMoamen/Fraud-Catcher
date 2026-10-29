# 🛡️ Autonomous Fraud Detection & Risk Intelligence System

**SIC 8 AI Track Graduation Project** | Domain: Banking, FinTech & Fraud Intelligence

---

## 📋 Project Overview

An end-to-end AI system designed to detect and mitigate fraud across three major vectors, connecting a real business problem to tested, demonstrable outputs:
1. **Transaction Fraud**: Graph-based anomaly detection with SHAP explainability.
2. **Phishing Websites**: Real-time URL classification using Random Forest.
3. **Receipt Tampering**: Vision-Language Model (Qwen2.5-VL) for document forgery detection.

This project fulfills all core technical framework requirements of the SIC 8 AI Track, delivering a containerized prediction API, an interactive risk interface, and comprehensive technical evidence.

---

## 🏗️ Solution Architecture

The system follows a modular, end-to-end architecture ensuring reproducible engineering and clear data flow:

```mermaid
graph TD
    A[Next.js Frontend UI] -->|HTTP/REST| B(FastAPI Backend)
    B -->|Load| C[(SQLite Database)]
    B -->|Load| D[Feature Cache .npz]
    B -->|Infer| E[XGBoost + SHAP Model]
    B -->|Infer| F[Random Forest Phishing Model]
    B -->|Infer| G[Qwen2.5-VL LoRA Adapter]
    B -->|API Call| H[OpenRouter LLM Agents]
    
    subgraph "Docker Container"
    B
    C
    D
    E
    F
    G
    end
    
    E -->|Explainability| A
    F -->|Risk Score| A
    G -->|Forgery Verdict| A

🚀 How to Run
Prerequisites
Docker Desktop (for backend containerization)
Node.js 18+ (for frontend development)
Git (for version control)
1. Backend (Dockerized API)


cd backend

# Build the Docker image (optimized for size and speed)
docker build -t fraud-catcher-api .

# Run the container and expose port 8000
docker run -p 8000:8000 fraud-catcher-api



📖 Interactive API Documentation will be available at: http://localhost:8000/docs
2. Frontend (Next.js Dashboard)

cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev



🌐 Dashboard will be available at: http://localhost:3000
3. Environment Variables
Create a .env file in the backend/ directory with your API key:

OPENROUTER_API_KEY=your_api_key_here


📊 Models & Technical Evidence
1. Transaction Fraud Detection (Graph Model)
Architecture: XGBoost Classifier with SHAP (SHapley Additive exPlanations).
Features: 132 graph-based features (flow balance, velocity, counterparty networks).
Metrics: ROC-AUC > 0.94, Precision@HighRisk > 0.89.
Evidence: See notebooks/ for EDA, PCA visualizations, and SHAP summary plots.
2. Phishing Website Detection
Architecture: Random Forest Classifier (26 engineered features).
Features: HTML structure, WHOIS data, SSL certificates, URL patterns.
Metrics: Accuracy: 96.1% | F1-Score: 0.995 | ROC-AUC: 0.98.
Evidence: See notebooks/Phishing_website_phase_2.ipynb for model comparison (Logistic Regression vs. Decision Tree vs. Random Forest).
3. Receipt Tampering Detection
Architecture: Qwen2.5-VL 3B (4-bit quantized LoRA adapter).
Task: Vision-Language understanding for text + image forgery analysis.
Evidence: See notebooks/Reciept__Tampering_Computer_Vision.ipynb for training loops, MLflow tracking, and validation metrics.

📁 Project Structure
Fraud-Catcher/
├── backend/
│   ├── orchestrator.py          # Main FastAPI application & routing
│   ├── phishing_engine.py       # Phishing detection feature extraction & inference
│   ├── graph_engine/            # Transaction graph feature cache & metadata
│   ├── receipt_model/           # Fine-tuned Qwen2.5-VL LoRA adapter (~72MB)
│   ├── shap_model.pkl           # Trained XGBoost + SHAP explainer artifact
│   ├── phishing_rf_model.pkl    # Random Forest model artifact
│   ├── Dockerfile               # Container build configuration
│   └── requirements.txt         # Python dependencies
├── frontend/
│   ├── src/app/                 # Next.js 14 App Router pages
│   ├── components/              # Reusable React components (Charts, Tables)
│   └── package.json             # Node.js dependencies
├── notebooks/
│   ├── Phishing_website_phase_2.ipynb       # EDA, modeling, and evaluation
│   └── Reciept__Tampering_Computer_Vision.ipynb # VLM fine-tuning and MLflow tracking
├── .gitignore                     # Git ignore rules (protects large files)
└── README.md                      # This file