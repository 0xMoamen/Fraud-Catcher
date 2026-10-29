# backend/train_shap_real.py
import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import joblib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from graph_engine.feature_cache import FeatureCache

print("🧠 Training XGBoost on REAL fraud labels...")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "graph_engine", "cache")

# 1. Load the feature cache
cache = FeatureCache(cache_dir=CACHE_DIR)
cache.load()
print(f"✅ Loaded {len(cache.account_to_idx)} accounts from cache")

# 2. Load the CSV with real labels
csv_path = os.path.join(BASE_DIR, "..", "data", "HI-Small_Trans.csv")
print(f"📖 Loading {csv_path}...")

df = pd.read_csv(csv_path, header=0, 
                 names=["timestamp", "from_bank", "src_acc", "to_bank", "dst_acc",
                        "amt_recv", "cur_recv", "amt_paid", "cur_paid", "fmt", "is_laundering"])

# 3. Create account-level labels based on DESTINATION accounts (the actual fraudsters/mules)
fraud_accounts = set()
for _, row in df.iterrows():
    if row['is_laundering'] == 1:
        # Label the DESTINATION account as fraud
        account_id = f"{row['to_bank']}_{row['dst_acc']}"
        fraud_accounts.add(account_id)

print(f"🔍 Found {len(fraud_accounts)} unique fraud destination accounts")

# 4. Create labels for all accounts in the cache
y = np.zeros(len(cache.account_to_idx), dtype=int)
for account_id, idx in cache.account_to_idx.items():
    if account_id in fraud_accounts:
        y[idx] = 1

print(f"📊 Fraud ratio: {y.mean()*100:.2f}% ({y.sum()} fraud accounts)")

# 5. Prepare features (first 127 base features)
X = cache.features[:, :127]

# 6. Sample for training (stratified to keep fraud ratio)
np.random.seed(42)
fraud_idx = np.where(y == 1)[0]
safe_idx = np.where(y == 0)[0]

# Take all fraud accounts + sample safe accounts to balance
sample_safe = np.random.choice(safe_idx, min(len(safe_idx), len(fraud_idx) * 10), replace=False)
sample_idx = np.concatenate([fraud_idx, sample_safe])
np.random.shuffle(sample_idx)

X_sample = X[sample_idx]
y_sample = y[sample_idx]

print(f"📊 Training on {len(X_sample)} samples ({y_sample.sum()} fraud, {len(y_sample) - y_sample.sum()} safe)")

# 7. Train XGBoost
model = xgb.XGBClassifier(
    n_estimators=200,
    max_depth=5,
    learning_rate=0.1,
    use_label_encoder=False,
    eval_metric='logloss',
    scale_pos_weight=(len(y_sample) - y_sample.sum()) / max(y_sample.sum(), 1)
)
model.fit(X_sample, y_sample)

print("✅ Model trained. Calculating SHAP explainer...")

# 8. Create SHAP explainer
explainer = shap.TreeExplainer(model)

# 9. Save everything
model_path = os.path.join(BASE_DIR, "shap_model.pkl")
joblib.dump((model, explainer, cache.feature_names[:127]), model_path)

print(f"💾 Saved SHAP model to {model_path}")
print(" Ready to use REAL SHAP values trained on actual fraud labels!")