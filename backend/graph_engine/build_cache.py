# backend/graph_engine/build_cache.py
import pandas as pd
import os
import sys
import numpy as np
import json
from pathlib import Path

# Add the backend directory to the Python path so imports work
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from graph_engine.feature_engineer import AMLFeatureEngineer
from graph_engine.feature_cache import FeatureCache


def build_cache_from_csv(csv_path: str = "data/HI-Small_Trans.csv"):
    """
    Build the feature cache from the IBM transaction CSV.
    """
    if not os.path.exists(csv_path):
        print(f"❌ Error: File not found at {csv_path}")
        print("💡 Please download 'HI-Small_Trans.csv' and place it in a 'data' folder in your root directory.")
        return

    print(f"📖 Loading transactions from {csv_path}...")
    
    # The raw CSV has a malformed header (two columns both called 'Account').
    # We must explicitly provide the correct column names, exactly as done in the notebook.
    COLS = [
        "timestamp", "from_bank", "src_acc", "to_bank", "dst_acc",
        "amt_recv", "cur_recv", "amt_paid", "cur_paid", "fmt", "is_laundering"
    ]
    
    df = pd.read_csv(csv_path, header=0, names=COLS)
    df = df.dropna(subset=["from_bank", "src_acc", "to_bank", "dst_acc", "is_laundering"]).reset_index(drop=True)
    
    print(f"   Loaded {len(df):,} transactions.")
    
    # Extract known labels for guilt-by-association features
    known_labels = {}
    if 'is_laundering' in df.columns:
        fraud_mask = df['is_laundering'] == 1
        fraud_accounts = pd.concat([
            df.loc[fraud_mask, 'src_acc'].astype(str),
            df.loc[fraud_mask, 'dst_acc'].astype(str)
        ]).unique()
        
        for acc in fraud_accounts:
            known_labels[acc] = 1
        print(f"   Found {len(fraud_accounts):,} unique accounts with known laundering labels.")
    
    # Build cache
    cache = FeatureCache()
    cache.build_from_transactions(df, known_labels)
    cache.save()
    
    print("\n✅ Feature cache built and saved!")
    print(f"   Total accounts: {len(cache.account_to_idx):,}")
    print(f"   Features per account: {cache.features.shape[1]}")
    print(f"   Cache location: {cache.cache_dir}")


if __name__ == "__main__":
    build_cache_from_csv()