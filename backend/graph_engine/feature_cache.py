# backend/graph_engine/feature_cache.py
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Optional


class FeatureCache:
    """
    Caches pre-calculated features for fast API lookup.
    Supports loading from/saving to disk.
    """
    
    def __init__(self, cache_dir: str = "backend/graph_engine/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.features: Optional[np.ndarray] = None
        self.feature_names: list = []
        self.account_to_idx: Dict[str, int] = {}
        self.idx_to_account: Dict[int, str] = {}
        
    def build_from_transactions(self, transactions_df: pd.DataFrame, 
                                known_labels: Optional[Dict[str, int]] = None):
        """Build the feature cache from raw transaction data."""
        from .feature_engineer import AMLFeatureEngineer
        
        print("🏗️  Building feature cache from transactions...")
        
        engineer = AMLFeatureEngineer(transactions_df)
        
        # Calculate base features (127)
        base_features, feature_names = engineer.calculate_all_features()
        
        # Calculate label features (5)
        if known_labels is None:
            known_labels = {}
        label_features = engineer.calculate_label_features(known_labels)
        
        # Combine: (N, 127) + (N, 5) = (N, 132)
        all_features = np.hstack([base_features, label_features])
        
        # Store
        self.features = all_features
        self.feature_names = feature_names + [
            'is_known_laundering', 'n_neighbors', 'n_positive_neighbors',
            'frac_positive_neighbors', 'log_n_positive_neighbors'
        ]
        self.account_to_idx = engineer.account_to_idx
        self.idx_to_account = engineer.idx_to_account
        
        print(f"✅ Feature cache built: {all_features.shape}")
        return self
    
    def save(self, filename: str = "feature_cache.npz"):
        """Save cache to disk"""
        if self.features is None:
            raise ValueError("No features to save. Call build_from_transactions first.")
        
        path = self.cache_dir / filename
        np.savez(
            path,
            features=self.features,
            feature_names=np.array(self.feature_names),
            account_to_idx_keys=list(self.account_to_idx.keys()),
            account_to_idx_values=list(self.account_to_idx.values()),
        )
        
        # Save mapping as JSON for easy inspection
        mapping = {
            'account_to_idx': self.account_to_idx,
            'idx_to_account': self.idx_to_account
        }
        with open(self.cache_dir / "account_mapping.json", 'w') as f:
            json.dump(mapping, f, indent=2)
        
        print(f"💾 Saved feature cache to {path}")
        
    def load(self, filename: str = "feature_cache.npz"):
        """Load cache from disk"""
        path = self.cache_dir / filename
        
        if not path.exists():
            raise FileNotFoundError(f"Cache file not found: {path}")
        
        data = np.load(path, allow_pickle=True)
        
        self.features = data['features']
        self.feature_names = list(data['feature_names'])
        
        # Reconstruct mappings
        keys = data['account_to_idx_keys']
        values = data['account_to_idx_values']
        self.account_to_idx = dict(zip(keys, values))
        self.idx_to_account = {v: k for k, v in self.account_to_idx.items()}
        
        print(f"📂 Loaded feature cache: {self.features.shape}")
        return self
    
    def get_features(self, account_id: str) -> np.ndarray:
        """Get 132 features for a specific account"""
        if account_id not in self.account_to_idx:
            raise ValueError(f"Account {account_id} not found in cache")
        
        idx = self.account_to_idx[account_id]
        return self.features[idx]
    
    def get_all_features(self) -> np.ndarray:
        """Get all features (N, 132)"""
        if self.features is None:
            raise ValueError("No features loaded. Call load() or build_from_transactions()")
        return self.features