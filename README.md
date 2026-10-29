# 🛡️ Autonomous Fraud Detection & Risk Intelligence System

## 📌 Project Overview
An end-to-end AI system designed to detect and mitigate fraud across three major vectors: Transaction Fraud (Graph/SHAP), Phishing Websites (Random Forest), and Receipt Tampering (Qwen2.5-VL Vision-Language Model). Built to meet the SIC 8 AI Track Graduation Project requirements.

## 🏗️ Solution Architecture
1. **Frontend**: Next.js / React dashboard for interactive risk analysis, batch processing, and file uploads.
2. **Backend**: FastAPI (Dockerized) serving REST endpoints with Pydantic validation.
3. **Models**: 
   - XGBoost + SHAP for transaction risk scoring and explainability.
   - Random Forest for real-time phishing URL detection.
   - Qwen2.5-VL (4-bit quantized LoRA) for receipt forgery detection.
4. **Infrastructure**: Local Docker containerization ensuring reproducible inference.

## 🚀 How to Run

### 1. Backend (Docker)
```bash
cd backend
docker build -t fraud-catcher-api .
docker run -p 8000:8000 fraud-catcher-api