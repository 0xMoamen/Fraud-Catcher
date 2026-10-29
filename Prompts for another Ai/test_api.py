# test_api.py
import requests
import json

url = "http://127.0.0.1:8000/score"

# Test 1: LLM Mode (High Risk Transaction)
payload = {
    "mode": "llm",
    "transaction": {
        "transaction_id": "TX_LLM_TEST",
        "amount": 8500.0,
        "currency": "USD",
        "merchant_category": "Crypto Exchange",
        "merchant_country": "NG",
        "customer_country": "US",
        "device_new": True,
        "ip_proxy": True,
        "velocity_last_1h": 8,
        "account_age_days": 2,
        "time_local": "03:15"
    }
}

print(" Testing LLM Mode (High Risk)...")
response = requests.post(url, json=payload)
print(json.dumps(response.json(), indent=2))
print("\n" + "="*60 + "\n")

# Test 2: Ensemble Mode
payload["mode"] = "ensemble"
print("🔍 Testing Ensemble Mode...")
response = requests.post(url, json=payload)
print(json.dumps(response.json(), indent=2))