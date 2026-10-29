# 🛡️ Autonomous Fraud Detection & Risk Intelligence System

**SIC 8 AI Track Graduation Project** | Domain: Banking, FinTech & Fraud Intelligence

---

## 📋 Project Overview

An end-to-end AI system designed to detect and mitigate fraud across three major vectors, connecting a real business problem to tested, demonstrable outputs:
1. **Transaction Fraud**: Graph-based anomaly detection with SHAP explainability.
​2. **Phishing Websites**: Real-time URL classification using Random Forest.
3. **Receipt Tampering**: Vision-Language Model (Qwen2.5-VL) for document forgery detection.

This project fulfills all core technical framework requirements of the SIC 8 AI Track, delivering a containerized prediction API, an interactive risk interface, and comprehensive technical evidence.

---
# Dataset References

This project uses the following publicly available datasets for training and evaluation:

## 1. Transaction Fraud Detection (Graph Model)
- **Dataset Name**: HI-Small_Trans (High-Imbalance Small Transactions)
- **Source**: Kaggle
- **Description**: Transaction records with fraud labels for graph-based anomaly detection
- **Features**: 132 engineered features including flow balance, velocity, and counterparty networks
- **Size**: ~515K accounts
- **Access**: Available on Kaggle (link in project notebooks)

## 2. Phishing Website Detection
- **Dataset Name**: Phishing Site URLs Dataset
- **Source**: Kaggle
- **Description**: Collection of legitimate and phishing URLs with HTML/WHOIS features
- **Features**: 26 features (URL patterns, HTML structure, SSL certificates, domain info)
- **Records**: 11,055 URLs (5,493 phishing, 5,562 legitimate)
- **Access**: Available on Kaggle

## 3. Receipt Tampering Detection
- **Dataset Name**: Find It Again - Document Forgery Detection
- **Source**: Kaggle
- **Description**: Authentic and forged receipt images for computer vision analysis
- **Modality**: Images (PNG format) with binary labels (authentic/forged)
- **Model**: Fine-tuned Qwen2.5-VL 3B with 4-bit LoRA
- **Access**: Available on Kaggle
- 
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
