# backend/ml_engine/predictor.py
import joblib
import pandas as pd
import os

# Load the model ONCE when the module is imported
model_path = os.path.join(os.path.dirname(__file__), 'model_pipeline.pkl')
pipeline = joblib.load(model_path)

def predict_ml(tx_dict: dict) -> float:
    """
    Takes a transaction dictionary from the API, maps the names to what the 
    model expects, and returns a fraud probability score from 0 to 100.
    """
    # 1. Map API names to Model Training names
    tx_dict['velocity_1h'] = tx_dict.pop('velocity_last_1h', 0)
    tx_dict['is_new_device'] = tx_dict.pop('device_new', False)
    tx_dict['ip_is_proxy'] = tx_dict.pop('ip_proxy', False)
    
    # 2. Convert the single dictionary into a Pandas DataFrame row
    df = pd.DataFrame([tx_dict])
    
    # Ensure boolean columns are actually booleans
    if 'is_new_device' in df.columns:
        df['is_new_device'] = df['is_new_device'].astype(bool)
    if 'ip_is_proxy' in df.columns:
        df['ip_is_proxy'] = df['ip_is_proxy'].astype(bool)
        
    # 3. Get the probability of class 1 (Fraud)
    fraud_probability = pipeline.predict_proba(df)[0][1]
    
    # Convert to 0-100 scale
    return round(fraud_probability * 100, 2)