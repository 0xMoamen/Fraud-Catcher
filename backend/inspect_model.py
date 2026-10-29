# backend/inspect_model.py
import json
import joblib
from pathlib import Path

MODEL_DIR = Path("backend/graph_engine/aml_best_model")

# Load metadata
with open(MODEL_DIR / "metadata.json") as f:
    metadata = json.load(f)

print("📋 Feature names the model expects (first 20):")
for i, name in enumerate(metadata["feature_names"][:20]):
    print(f"  [{i:3d}] {name}")

print(f"\n📊 Total features expected: {len(metadata['feature_names'])}")

# Check what's in the bundle
bundle = joblib.load(MODEL_DIR / "sklearn_models.joblib")
print(f"\n🔧 Bundle keys: {list(bundle.keys())}")
print(f" Scaler type: {type(bundle['scaler'])}")
print(f" Scaler mean shape: {bundle['scaler'].mean_.shape}")
print(f" Scaler scale shape: {bundle['scaler'].scale_.shape}")