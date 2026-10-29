# backend/debug_account.py
import sys
import os
import numpy as np
from pathlib import Path

# Add backend to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from graph_engine.feature_cache import FeatureCache
from graph_engine.model_loader import predict_aml_ensemble

# Load the cache
cache = FeatureCache()
cache.load()

# The account we're testing
test_account = "10_8000EBD30"

print(f"🔍 Debugging account: {test_account}")
print("=" * 60)

# Check if account exists in cache
if test_account in cache.account_to_idx:
    idx = cache.account_to_idx[test_account]
    print(f"✅ Account found at index: {idx}")
    
    # Get the features
    features = cache.get_features(test_account)
    print(f"📊 Feature shape: {features.shape}")
    print(f"📊 Feature range: [{features.min():.4f}, {features.max():.4f}]")
    print(f"📊 Feature mean: {features.mean():.4f}")
    print(f"📊 Non-zero features: {np.count_nonzero(features)} / {len(features)}")
    
    # Show first 10 features
    print(f"\n📋 First 10 features:")
    for i in range(min(10, len(features))):
        print(f"   [{i:3d}] {cache.feature_names[i] if i < len(cache.feature_names) else 'unknown':30s} = {features[i]:.6f}")
    
    # Run the model
    print(f"\n Running model prediction...")
    result = predict_aml_ensemble(features.tolist())
    print(f"✅ Result: {result}")
    
else:
    print(f"❌ Account NOT found in cache!")
    print(f"\n🔍 Searching for similar accounts...")
    
    # Search for accounts containing "8000EBD30"
    similar = [acc for acc in cache.account_to_idx.keys() if "8000EBD30" in acc]
    if similar:
        print(f"Found {len(similar)} similar accounts:")
        for acc in similar[:10]:
            print(f"   - {acc}")
    else:
        print("No similar accounts found.")
    
    # Show some sample accounts
    print(f"\n📋 Sample accounts from cache (first 20):")
    for i, acc in enumerate(list(cache.account_to_idx.keys())[:20]):
        print(f"   [{i}] {acc}")

print("\n" + "=" * 60)
print("Debug complete!")