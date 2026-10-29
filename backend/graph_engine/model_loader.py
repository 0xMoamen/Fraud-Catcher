# backend/graph_engine/model_loader.py
import os
import json
import joblib
import numpy as np
import warnings

# Suppress the harmless version mismatch warning
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "aml_best_model")

print(f"📂 Loading AML Graph Artifacts from: {MODEL_DIR}")

# 1. Load Metadata
with open(os.path.join(MODEL_DIR, "metadata.json"), "r") as f:
    METADATA = json.load(f)

EXPECTED_FEATURE_NAMES = METADATA["feature_names"]
print(f"📊 Model expects {len(EXPECTED_FEATURE_NAMES)} base features")

# 2. Load Models
BUNDLE = joblib.load(os.path.join(MODEL_DIR, "sklearn_models.joblib"))
SCALER = BUNDLE["scaler"]
NODE_GBM = BUNDLE["node_gbm"]
TX_GBM = BUNDLE["tx_gbm"]

print(f"✅ Loaded Node GBM ({NODE_GBM.n_iter_} trees)")
print(f"✅ Loaded Tx GBM ({TX_GBM.n_iter_} trees)")

# 3. Detect how many features the models actually expect
NODE_N_FEATURES = getattr(NODE_GBM, 'n_features_in_', 127)
TX_N_FEATURES = getattr(TX_GBM, 'n_features_in_', 127)
print(f"🔍 Node GBM expects {NODE_N_FEATURES} features")
print(f"🔍 Tx GBM expects {TX_N_FEATURES} features")

T_BALANCED = METADATA["thresholds_on_rank"]["balanced"]
T_HIGH_RECALL = METADATA["thresholds_on_rank"]["high_recall"]

def predict_aml_ensemble(feature_vector: list[float]) -> dict:
    """
    Predicts fraud probability using the ACTUAL models from the notebook.
    Automatically handles 127 vs 132 feature formatting.
    """
    if len(feature_vector) < 127:
        raise ValueError(f"Expected at least 127 features, got {len(feature_vector)}")
    
    # Split into base (127) and label (remaining, usually 5)
    base_features = np.array([feature_vector[:127]], dtype=np.float32)
    label_features = np.array([feature_vector[127:]], dtype=np.float32)
    
    # Scale ONLY the base features (as the scaler was fitted on 127 features)
    base_scaled = np.clip(SCALER.transform(base_features), -5, 5).astype(np.float32)
    
    # Format input for Node GBM based on what it expects
    if NODE_N_FEATURES == 132 and len(label_features) > 0:
        node_input = np.hstack([base_scaled, label_features])
    else:
        node_input = base_scaled
        
    # Format input for Tx GBM based on what it expects
    if TX_N_FEATURES == 132 and len(label_features) > 0:
        tx_input = np.hstack([base_scaled, label_features])
    else:
        tx_input = base_scaled
    
    # Get actual predictions
    node_prob = float(NODE_GBM.predict_proba(node_input)[0][1])
    tx_prob = float(TX_GBM.predict_proba(tx_input)[0][1])
    
    # Blend probabilities (simple average, matches notebook baseline)
    ensemble_prob = (node_prob + tx_prob) / 2.0
    
    # Calibrated threshold for single predictions (top ~1-2% of accounts)
    verdict = "HIGH_RISK" if ensemble_prob > 0.15 else "LOW_RISK"
    
    return {
        "model": "real_aml_ensemble",
        "node_gbm_score": round(node_prob * 100, 2),
        "tx_gbm_score": round(tx_prob * 100, 2),
        "ensemble_score": round(ensemble_prob * 100, 2),
        "verdict": verdict,
        "threshold_balanced": T_BALANCED,
        "threshold_high_recall": T_HIGH_RECALL
    }

# Quick self-test
if __name__ == "__main__":
    # Test with dummy features
    dummy_features = [0.0] * 132
    result = predict_aml_ensemble(dummy_features)
    print("\n🧪 Test Prediction Result:", result)