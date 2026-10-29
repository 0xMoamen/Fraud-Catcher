# backend/setup_database.py
import sqlite3
import pandas as pd
import numpy as np
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DB_PATH = os.path.join(os.path.dirname(__file__), "fraudcatcher.db")

def init_database():
    """Create database tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            amount REAL NOT NULL,
            timestamp TEXT NOT NULL,
            merchant TEXT,
            country TEXT,
            risk_score REAL DEFAULT 0,
            status TEXT DEFAULT 'approved',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            risk_score REAL NOT NULL,
            triggered_at TEXT DEFAULT CURRENT_TIMESTAMP,
            reason TEXT,
            status TEXT DEFAULT 'new',
            priority TEXT DEFAULT 'high',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS investigations (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            alert_id TEXT,
            notes TEXT,
            status TEXT DEFAULT 'open',
            analyst TEXT DEFAULT 'Admin User',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()
    print("✅ Database tables created")

import numpy as np

def calculate_heuristic_score(features: np.ndarray) -> float:
    """Calculate fraud score using feature-based heuristics."""
    if len(features) < 132:
        features = np.pad(features, (0, 132 - len(features)), mode='constant')
    
    log_n_out = features[0] if len(features) > 0 else 0
    log_n_in = features[1] if len(features) > 1 else 0
    flow_balance = features[4] if len(features) > 4 else 0
    log_volume = features[5] if len(features) > 5 else 0
    log_uniq_out = features[12] if len(features) > 12 else 0
    log_uniq_in = features[13] if len(features) > 13 else 0
    
    score = 0.0
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
    
    return min(score, 100.0)


def import_sample_transactions(sample_size=500):
    """Import sample transactions from CSV and score them"""
    from graph_engine.feature_cache import FeatureCache
    
    # Try multiple possible paths
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "data", "HI-Small_Trans.csv"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "HI-Small_Trans.csv"),
        r"C:\Users\Canter\Desktop\Fraud-Catcher\data\HI-Small_Trans.csv",
    ]
    
    csv_path = None
    for path in possible_paths:
        if os.path.exists(path):
            csv_path = path
            break
    
    if not csv_path:
        print(f"❌ CSV not found! Tried:")
        for path in possible_paths:
            print(f"   - {path}")
        return
    
    print(f"📖 Found CSV at: {csv_path}")
    print(f"📖 Loading sample of {sample_size} transactions...")
    
    df = pd.read_csv(csv_path, nrows=sample_size, header=0, 
                     names=["timestamp", "from_bank", "src_acc", "to_bank", "dst_acc",
                            "amt_recv", "cur_recv", "amt_paid", "cur_paid", "fmt", "is_laundering"])
    
    # Load feature cache for scoring (use absolute path)
    cache_dir = os.path.join(os.path.dirname(__file__), "graph_engine", "cache")
    cache = FeatureCache(cache_dir=cache_dir)
    try:
        cache.load()
        print(f"✅ Loaded cache with {len(cache.account_to_idx)} accounts")
    except FileNotFoundError:
        print("️  No feature cache found. Transactions will have 0 risk scores.")
        cache = None
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Clear existing transactions
    cursor.execute("DELETE FROM transactions")
    
    merchants = ["Crypto Exchange", "Hotel", "Grocery Store", "Business Services", 
                 "Wire Transfer", "Gas Station", "Restaurant", "Electronics"]
    countries = ["US", "NG", "FR", "RU", "GB", "DE", "CN"]
    
    imported = 0
    for idx, row in df.iterrows():
        tx_id = f"TXN_{idx+1:05d}"
        account_id = f"{row['from_bank']}_{row['src_acc']}"
        amount = float(row['amt_paid']) if pd.notna(row['amt_paid']) else 0
        timestamp = str(row['timestamp'])
        merchant = merchants[idx % len(merchants)]
        country = countries[idx % len(countries)]
        
        # Calculate risk score if cache is available
        risk_score = 0
        if cache and account_id in cache.account_to_idx:
            features = cache.get_features(account_id)
            risk_score = calculate_heuristic_score(features)
        
        # Set status based on risk
        if risk_score >= 70:
            status = "declined"
        elif risk_score >= 40:
            status = "review"
        else:
            status = "approved"
        
        cursor.execute("""
            INSERT OR REPLACE INTO transactions 
            (id, account_id, amount, timestamp, merchant, country, risk_score, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (tx_id, account_id, amount, timestamp, merchant, country, risk_score, status))
        
        imported += 1
        if imported % 100 == 0:
            print(f"   Processed {imported} transactions...")
    
    conn.commit()
    conn.close()
    print(f"✅ Imported {imported} transactions with risk scores")

def generate_alerts():
    """Auto-generate alerts for high-risk accounts"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get high-risk transactions
    cursor.execute("""
        SELECT DISTINCT account_id, MAX(risk_score) as max_score
        FROM transactions
        WHERE risk_score >= 70
        GROUP BY account_id
    """)
    
    high_risk_accounts = cursor.fetchall()
    
    # Clear existing alerts
    cursor.execute("DELETE FROM alerts")
    
    alert_count = 0
    for account_id, max_score in high_risk_accounts:
        alert_id = f"ALT_{alert_count+1:04d}"
        reason = f"High risk score ({max_score:.0f}) detected on account {account_id}"
        priority = "high" if max_score >= 80 else "medium"
        
        cursor.execute("""
            INSERT INTO alerts (id, account_id, risk_score, reason, priority)
            VALUES (?, ?, ?, ?, ?)
        """, (alert_id, account_id, max_score, reason, priority))
        
        alert_count += 1
    
    conn.commit()
    conn.close()
    print(f"✅ Generated {alert_count} alerts for high-risk accounts")

if __name__ == "__main__":
    print(" Setting up FraudCatcher database...")
    init_database()
    import_sample_transactions(sample_size=500)
    generate_alerts()
    print("\n🎉 Database setup complete!")
    print(f"📁 Database location: {DB_PATH}")