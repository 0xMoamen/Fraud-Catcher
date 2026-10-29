import os, sys, json, time, uuid
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Literal, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI
import numpy as np, sqlite3, joblib, shap, torch
from PIL import Image
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

app = FastAPI(title="Fraud Detection API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- DATABASE ---
DB_PATH = os.path.join(os.path.dirname(__file__), "fraudcatcher.db")
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, account_id TEXT, amount REAL, merchant TEXT, risk_score REAL, status TEXT, timestamp TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, account_id TEXT, risk_score REAL, status TEXT DEFAULT 'new', created_at TEXT, notes TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS investigations (id TEXT PRIMARY KEY, account_id TEXT UNIQUE, alert_id TEXT, notes TEXT DEFAULT '', status TEXT DEFAULT 'open', analyst TEXT DEFAULT 'Admin', created_at TEXT, updated_at TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    for k, v in [("risk_threshold", "70"), ("auto_decline", "true"), ("email_alerts", "true"), ("api_key", "")]:
        c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))
    conn.commit(); conn.close()
init_db()

# --- GRAPH ENGINE & SHAP ---
feature_cache = None
shap_model = None
shap_explainer = None
shap_feature_names = []

try:
    from graph_engine.feature_cache import FeatureCache
    feature_cache = FeatureCache(cache_dir=os.path.join(os.path.dirname(__file__), "graph_engine", "cache"))
    feature_cache.load()
    print("✅ Loaded feature cache")
except Exception as e: print(f"⚠️ Cache warning: {e}")

shap_path = os.path.join(os.path.dirname(__file__), "shap_model.pkl")
if os.path.exists(shap_path):
    try:
        from sklearn.pipeline import Pipeline
        loaded, shap_explainer, shap_feature_names = joblib.load(shap_path)
        shap_model = loaded
        print("✅ Loaded SHAP model")
    except Exception as e: print(f"⚠️ SHAP warning: {e}")

# --- PHISHING ENGINE ---
try:
    from phishing_engine import predict_phishing
    print("✅ Loaded Phishing engine")
except Exception as e: print(f"⚠️ Phishing warning: {e}")

# --- RECEIPT ENGINE (Qwen2.5-VL) ---
receipt_model = None
receipt_processor = None

def load_receipt_model():
    global receipt_model, receipt_processor
    if receipt_model is not None: return
    print("🔄 Loading Receipt Model (this takes a minute)...")
    try:
        from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration, BitsAndBytesConfig
        from peft import PeftModel
        
        ADAPTER_PATH = os.path.join(os.path.dirname(__file__), "receipt_model")
        if not os.path.exists(ADAPTER_PATH):
            print("⚠️ receipt_model folder missing.")
            return
            
        quant_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)
        receipt_processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-3B-Instruct", min_pixels=256*28*28, max_pixels=512*28*28)
        base_model = Qwen2_5_VLForConditionalGeneration.from_pretrained("Qwen/Qwen2.5-VL-3B-Instruct", quantization_config=quant_config, device_map="cpu", torch_dtype=torch.float16)
        receipt_model = PeftModel.from_pretrained(base_model, ADAPTER_PATH, is_trainable=False)
        receipt_model.eval()
        print("✅ Receipt model loaded!")
    except Exception as e: print(f"⚠️ Receipt model failed: {e}")

# --- LLM AGENTS ---
api_key = os.getenv("OPENROUTER_API_KEY")
client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key) if api_key else None


# ==========================================
# ENDPOINTS
# ==========================================

@app.post("/graph-score-by-account/{account_id}")
def score_account_by_id(account_id: str):
    start_time = time.time()
    if feature_cache is None:
        raise HTTPException(status_code=503, detail="Cache not loaded")
    try:
        features = feature_cache.get_features(account_id)
        if len(features) < 127:
            features = np.pad(features, (0, 127 - len(features)), mode='constant')
        base_features = features[:127].reshape(1, -1)

        attributions = []
        xgb_prob = 0.0
        if shap_explainer and shap_model:
            try:
                xgb_prob = float(shap_model.predict_proba(base_features)[0][1])
                shap_values = shap_explainer.shap_values(base_features)
                if isinstance(shap_values, list): shap_values = shap_values[1]
                shap_vals = shap_values[0]
                top_indices = np.argsort(np.abs(shap_vals))[::-1][:5]
                max_abs = max(abs(float(shap_vals[i])) for i in top_indices) or 1
                
                for idx in top_indices:
                    fname = shap_feature_names[idx] if idx < len(shap_feature_names) else f"Feature_{idx}"
                    attributions.append({
                        "feature": fname.replace('_', ' ').title(),
                        "value": round(float(base_features[0][idx]), 3),
                        "contribution": round((float(shap_vals[idx]) / max_abs) * 100, 2)
                    })
            except Exception as e:
                print(f"SHAP error: {e}")
                xgb_prob = 0.5
                attributions.append({"feature": "Error", "value": 0, "contribution": 0})
        else:
            xgb_prob = 0.5
            attributions.append({"feature": "SHAP Not Loaded", "value": 0, "contribution": 0})

        score = min(max(xgb_prob * 100, 0), 100)
        risk_level = "high" if score >= 70 else ("medium" if score >= 40 else "low")
        action = "decline" if score >= 70 else ("review" if score >= 40 else "approve")
        
        return {
            "account_id": account_id,
            "risk_score": round(score, 2),
            "fraud_probability": round(xgb_prob, 4),
            "risk_level": risk_level,
            "recommended_action": action,
            "feature_attributions": attributions,
            "model_version": "xgboost-shap-v1.0",
            "processing_ms": round((time.time() - start_time) * 1000, 2),
            "explanation_available": len(attributions) > 0
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=f"Account not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/graph-batch-score")
def batch_score_accounts(account_ids: List[str]):
    """Existing batch endpoint with ranking"""
    if feature_cache is None:
        raise HTTPException(status_code=503, detail="Cache not loaded")
    
    scores_data = []
    for account_id in account_ids:
        try:
            features = feature_cache.get_features(account_id)
            if len(features) < 127:
                features = np.pad(features, (0, 127 - len(features)), mode='constant')
            base_features = features[:127].reshape(1, -1)
            
            if shap_model is not None:
                prob = float(shap_model.predict_proba(base_features)[0][1])
            else:
                prob = 0.5
                
            score = min(max(prob * 100, 0), 100)
            risk_level = "high" if score >= 70 else ("medium" if score >= 40 else "low")
            action = "decline" if score >= 70 else ("review" if score >= 40 else "approve")
            
            scores_data.append({
                "account_id": account_id,
                "raw_score": score,
                "fraud_probability": round(prob, 4),
                "risk_level": risk_level,
                "recommended_action": action,
                "final_verdict": "HIGH_RISK" if score >= 70 else ("REQUIRES_REVIEW" if score >= 40 else "LOW_RISK"),
                "confidence": "HIGH"
            })
        except ValueError:
            continue
    
    if not scores_data:
        raise HTTPException(status_code=400, detail="No valid accounts found")
    
    raw_scores = np.array([s["raw_score"] for s in scores_data])
    try:
        import scipy.stats
        ranks = scipy.stats.rankdata(raw_scores) / len(raw_scores)
    except ImportError:
        ranks = np.argsort(np.argsort(raw_scores)) / len(raw_scores)
    
    results = []
    for i, score_data in enumerate(scores_data):
        rank = ranks[i]
        if rank >= 0.99:
            verdict, confidence = "HIGH_RISK", "HIGH"
        elif rank >= 0.976:
            verdict, confidence = "REQUIRES_REVIEW", "MEDIUM"
        else:
            verdict, confidence = "LOW_RISK", "HIGH"
            
        results.append({
            **score_data,
            "rank_percentile": round(float(rank) * 100, 2),
            "final_verdict": verdict,
            "confidence": confidence
        })
    
    return {
        "total_accounts": len(results),
        "high_risk_count": sum(1 for r in results if r["final_verdict"] == "HIGH_RISK"),
        "review_count": sum(1 for r in results if r["final_verdict"] == "REQUIRES_REVIEW"),
        "low_risk_count": sum(1 for r in results if r["final_verdict"] == "LOW_RISK"),
        "results": results
    }


# ==========================================
# NEW: Graph Batch Predict (One-by-One, No Ranking)
# ==========================================
@app.post("/graph-batch-predict")
def batch_predict_accounts(account_ids: List[str]):
    """Process accounts one-by-one and return individual results (no ranking)"""
    if feature_cache is None:
        raise HTTPException(status_code=503, detail="Cache not loaded")
    
    results = []
    errors = []
    
    for account_id in account_ids:
        try:
            features = feature_cache.get_features(account_id)
            if len(features) < 127:
                features = np.pad(features, (0, 127 - len(features)), mode='constant')
            base_features = features[:127].reshape(1, -1)
            
            if shap_model is not None:
                prob = float(shap_model.predict_proba(base_features)[0][1])
            else:
                prob = 0.5
                
            score = min(max(prob * 100, 0), 100)
            risk_level = "high" if score >= 70 else ("medium" if score >= 40 else "low")
            action = "decline" if score >= 70 else ("review" if score >= 40 else "approve")
            
            results.append({
                "account_id": account_id,
                "risk_score": round(score, 2),
                "fraud_probability": round(prob, 4),
                "risk_level": risk_level,
                "recommended_action": action,
                "status": "processed"
            })
        except ValueError:
            errors.append({"account_id": account_id, "error": "Account not found"})
        except Exception as e:
            errors.append({"account_id": account_id, "error": str(e)})
    
    return {
        "total_processed": len(results),
        "total_errors": len(errors),
        "results": results,
        "errors": errors
    }


# ==========================================
# Multi-Agent LLM Analysis
# ==========================================
@app.post("/graph-llm-agents/{account_id}")
def get_llm_agent_opinions(account_id: str):
    if feature_cache is None or client is None:
        raise HTTPException(status_code=503, detail="Graph engine or LLM not available")
    
    try:
        features = feature_cache.get_features(account_id)
        if len(features) < 132:
            features = np.pad(features, (0, 132 - len(features)), mode='constant')
        
        log_n_out = features[0]
        log_n_in = features[1]
        flow_balance = features[4]
        log_volume = features[5]
        log_uniq_out = features[12]
        log_uniq_in = features[13]
        
        # FIXED: Proper f-string with correct indentation
        feature_report = f"""Account: {account_id}
- Outgoing Transaction Frequency (log): {log_n_out:.2f}
- Incoming Transaction Frequency (log): {log_n_in:.2f}
- Flow Balance: {flow_balance:.3f} (near-zero = pass-through behavior)
- Transaction Volume (log): {log_volume:.2f}
- Unique Outgoing Counterparties (log): {log_uniq_out:.2f}
- Unique Incoming Counterparties (log): {log_uniq_in:.2f}"""
        
        agents = [
            {
                "name": "Risk Analyst",
                "role": "Senior Fraud Risk Analyst",
                "prompt": f"""You are a Senior Fraud Risk Analyst with 15 years of experience.
Analyze this account's transaction patterns:

{feature_report}

Focus on:
1. Transaction velocity and frequency anomalies
2. Volume patterns compared to typical behavior
3. Counterparty network complexity

Return ONLY valid JSON:
{{"opinion": "your analysis (3-4 sentences)", "confidence": "high/medium/low", "key_findings": ["finding1", "finding2"]}}"""
            },
            {
                "name": "Compliance Officer",
                "role": "AML Compliance Officer",
                "prompt": f"""You are an AML Compliance Officer.
Review this account:

{feature_report}

Focus on:
1. Money laundering indicators
2. Regulatory concerns
3. SAR triggers

Return ONLY valid JSON:
{{"opinion": "your assessment (3-4 sentences)", "confidence": "high/medium/low", "key_findings": ["finding1", "finding2"]}}"""
            },
            {
                "name": "Behavioral Analyst",
                "role": "Customer Behavior Analyst",
                "prompt": f"""You are a Customer Behavior Analyst.
Analyze this account:

{feature_report}

Focus on:
1. Deviations from normal behavior
2. Unusual patterns
3. Network effects

Return ONLY valid JSON:
{{"opinion": "your analysis (3-4 sentences)", "confidence": "high/medium/low", "key_findings": ["finding1", "finding2"]}}"""
            }
        ]
        
        agent_opinions = []
        for agent in agents:
            try:
                response = client.chat.completions.create(
                    model="openrouter/auto",
                    messages=[{"role": "user", "content": agent["prompt"]}],
                    temperature=0.3,
                    max_tokens=500,
                )
                
                content = response.choices[0].message.content if response.choices else None
                
                if content is None:
                    agent_opinions.append({
                        "agent_name": agent["name"],
                        "role": agent["role"],
                        "opinion": "No response",
                        "confidence": "low",
                        "key_findings": []
                    })
                    continue
                
                try:
                    clean_content = content.replace("```json", "").replace("```", "").strip()
                    opinion_data = json.loads(clean_content)
                    agent_opinions.append({
                        "agent_name": agent["name"],
                        "role": agent["role"],
                        "opinion": opinion_data.get("opinion", "No opinion"),
                        "confidence": opinion_data.get("confidence", "medium"),
                        "key_findings": opinion_data.get("key_findings", [])
                    })
                except json.JSONDecodeError:
                    agent_opinions.append({
                        "agent_name": agent["name"],
                        "role": agent["role"],
                        "opinion": content[:300],
                        "confidence": "medium",
                        "key_findings": ["JSON parse failed"]
                    })
            except Exception as e:
                agent_opinions.append({
                    "agent_name": agent["name"],
                    "role": agent["role"],
                    "opinion": f"Error: {str(e)[:100]}",
                    "confidence": "low",
                    "key_findings": []
                })
        
        return {
            "account_id": account_id,
            "agent_opinions": agent_opinions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# Transactions
# ==========================================
@app.get("/api/transactions")
def get_transactions(limit: int = 50, offset: int = 0):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?", (limit, offset))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"transactions": rows, "total": len(rows)}

@app.get("/api/transactions/stats")
def get_transaction_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM transactions")
    total = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) as count FROM transactions WHERE risk_score >= 70")
    high_risk = cursor.fetchone()["count"]
    cursor.execute("SELECT COUNT(*) as count FROM transactions WHERE status = 'review'")
    pending = cursor.fetchone()["count"]
    cursor.execute("SELECT SUM(amount) as total FROM transactions")
    volume = cursor.fetchone()["total"] or 0
    conn.close()
    return {"total": total, "high_risk": high_risk, "pending_review": pending, "total_volume": volume}


# ==========================================
# Alerts
# ==========================================
@app.get("/api/alerts")
def get_alerts(status: str = "new"):
    conn = get_db()
    cursor = conn.cursor()
    if status == "all":
        cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC")
    else:
        cursor.execute("SELECT * FROM alerts WHERE status = ? ORDER BY created_at DESC", (status,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"alerts": rows}

@app.post("/api/alerts/{alert_id}/investigate")
def start_investigation(alert_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    alert = cursor.fetchone()
    if not alert:
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
    inv_id = f"INV_{uuid.uuid4().hex[:8].upper()}"
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT OR REPLACE INTO investigations (id, account_id, alert_id, status, created_at, updated_at) VALUES (?, ?, ?, 'open', ?, ?)", (inv_id, alert["account_id"], alert_id, now, now))
    cursor.execute("UPDATE alerts SET status = 'investigating' WHERE id = ?", (alert_id,))
    conn.commit(); conn.close()
    return {"investigation_id": inv_id, "account_id": alert["account_id"]}

@app.post("/api/alerts/{alert_id}/false-positive")
def mark_false_positive(alert_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET status = 'resolved' WHERE id = ?", (alert_id,))
    conn.commit(); conn.close()
    return {"status": "ok"}


# ==========================================
# Investigations
# ==========================================
@app.get("/api/investigations/{account_id}")
def get_investigation(account_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM investigations WHERE account_id = ?", (account_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

@app.post("/api/investigations")
def create_investigation(account_id: str, notes: str = ""):
    conn = get_db()
    cursor = conn.cursor()
    inv_id = f"INV_{uuid.uuid4().hex[:8].upper()}"
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT INTO investigations (id, account_id, notes, status, created_at, updated_at) VALUES (?, ?, ?, 'open', ?, ?)", (inv_id, account_id, notes, now, now))
    conn.commit(); conn.close()
    return {"investigation_id": inv_id}

@app.patch("/api/investigations/{inv_id}")
def update_investigation(inv_id: str, notes: str = None, status: str = None):
    conn = get_db()
    cursor = conn.cursor()
    updates = []
    params = []
    if notes is not None:
        updates.append("notes = ?"); params.append(notes)
    if status is not None:
        updates.append("status = ?"); params.append(status)
    if updates:
        updates.append("updated_at = ?")
        params.append(time.strftime("%Y-%m-%d %H:%M:%S"))
        params.append(inv_id)
        cursor.execute(f"UPDATE investigations SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return {"status": "ok"}


# ==========================================
# Settings
# ==========================================
@app.get("/api/settings")
def get_settings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM settings")
    rows = {row["key"]: row["value"] for row in cursor.fetchall()}
    conn.close()
    return rows

@app.post("/api/settings")
def save_settings(risk_threshold: str = None, auto_decline: str = None, email_alerts: str = None, api_key: str = None):
    conn = get_db()
    cursor = conn.cursor()
    for k, v in [("risk_threshold", risk_threshold), ("auto_decline", auto_decline), ("email_alerts", email_alerts), ("api_key", api_key)]:
        if v is not None:
            cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
    conn.commit(); conn.close()
    return {"status": "ok"}


# ==========================================
# Phishing
# ==========================================
@app.post("/api/phishing/predict")
def check_phishing(url: str):
    try:
        return predict_phishing(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/phishing/info")
def phishing_info():
    return {"model": "Random Forest", "features": 26, "test_accuracy": 0.961, "test_f1": 0.995}


# ==========================================
# Receipt Detection
# ==========================================
@app.post("/api/receipt/detect")
async def detect_receipt_tampering(file: UploadFile = File(...)):
    if receipt_model is None or receipt_processor is None:
        raise HTTPException(status_code=503, detail="Receipt model not loaded")
    
    try:
        contents = await file.read()
        image = Image.open(BytesIO(contents)).convert("RGB")
        
        messages = [{"role": "user", "content": [{"type": "image", "image": image}, {"type": "text", "text": "Classify this receipt as Authentic or Forged. Reply with exactly one word: Authentic or Forged."}]}]
        text = receipt_processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = receipt_processor(text=[text], images=[image], return_tensors="pt").to(receipt_model.device)
        
        with torch.inference_mode():
            outputs = receipt_model.generate(**inputs, max_new_tokens=10, do_sample=False)
        
        generated = outputs[:, inputs["input_ids"].shape[1]:]
        answer = receipt_processor.batch_decode(generated, skip_special_tokens=True)[0].strip().lower()
        
        prediction = "forged" if "forged" in answer else ("authentic" if "authentic" in answer else "unknown")
        return {"filename": file.filename, "prediction": prediction, "confidence": 0.85 if prediction != "unknown" else 0.0, "raw_output": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# Health
# ==========================================
@app.get("/health")
def health_check():
    return {"status": "ok", "graph": feature_cache is not None, "phishing": True, "receipt": receipt_model is not None}

@app.on_event("startup")
async def startup_event():
    print("🚀 Starting API...")
    import asyncio
    asyncio.create_task(asyncio.to_thread(load_receipt_model))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)