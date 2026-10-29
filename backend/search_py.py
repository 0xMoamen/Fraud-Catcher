# backend/find_top_risk_accounts.py
import numpy as np
from pathlib import Path
import json
import sys
sys.path.insert(0, "backend")
from graph_engine.feature_cache import FeatureCache

cache = FeatureCache()
cache.load()

# Score all accounts using the heuristic
scores = []
for acc_id, idx in cache.account_to_idx.items():
    features = cache.features[idx]
    score = 0.0
    
    log_volume = features[5] if len(features) > 5 else 0
    flow_balance = features[4] if len(features) > 4 else 0
    log_uniq_out = features[12] if len(features) > 12 else 0
    log_uniq_in = features[13] if len(features) > 13 else 0
    log_n_out = features[0] if len(features) > 0 else 0
    log_n_in = features[1] if len(features) > 1 else 0
    
    if log_volume > 8: score += 20
    elif log_volume > 6: score += 10
    if abs(flow_balance) < 0.1: score += 25
    elif abs(flow_balance) < 0.2: score += 15
    if log_uniq_out > 3: score += 20
    elif log_uniq_out > 2: score += 10
    if log_uniq_in > 3: score += 20
    elif log_uniq_in > 2: score += 10
    if log_n_out > 2: score += 15
    if log_n_in > 2: score += 15
    
    scores.append((min(score, 100), acc_id))

scores.sort(reverse=True)

print("🏆 Top 20 Highest Risk Accounts (will rank in top 1%):")
print("=" * 60)
for i, (score, acc_id) in enumerate(scores[:20]):
    print(f"{i+1:2d}. {acc_id:25s} Score: {score:.2f}")

# Save for presets
with open("backend/top_risk_accounts.json", "w") as f:
    json.dump([acc for _, acc in scores[:10]], f, indent=2)
print("\n💾 Saved top 10 accounts to backend/top_risk_accounts.json")