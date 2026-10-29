import pandas as pd
import requests
import json
import time

# Load the generated data
df = pd.read_csv("fraud_dataset.csv")

results = []
endpoint_url = "http://127.0.0.1:8000/score"

print("🚀 Starting LLM scoring loop...\n")

for index, row in df.iterrows():
    payload = {
        "transaction_id": row["transaction_id"],
        "amount": float(row["amount"]),
        "currency": row["currency"],
        "merchant_category": row["merchant_category"],
        "merchant_country": row["merchant_country"],
        "customer_country": row["customer_country"],
        "device_new": bool(row["is_new_device"]),
        "ip_proxy": bool(row["ip_is_proxy"]),
        "velocity_last_1h": int(row["velocity_1h"]),
        "shipping_address_match_billing": True,
        "account_age_days": int(row["account_age_days"]),
        "time_local": row["timestamp"].split(" ")[1][:5]
    }
    
    try:
        response = requests.post(endpoint_url, json=payload, timeout=15)
        llm_result = response.json()
        
        score = llm_result.get("fraud_score", -1)
        predicted_fraud = 1 if score >= 70 else 0
        actual_fraud = int(row["is_fraud"])
        
        results.append({
            "tx_id": row["transaction_id"],
            "actual": actual_fraud,
            "predicted": predicted_fraud,
            "score": score,
            "llm_reasoning": llm_result.get("reasoning", "")[:100] + "..."
        })
        
        status = "🚨 CAUGHT" if (actual_fraud == 1 and predicted_fraud == 1) else "✅ OK" if (actual_fraud == 0 and predicted_fraud == 0) else "⚠️ MISSED"
        print(f"{status} | TX: {row['transaction_id']} | Actual: {actual_fraud} | LLM Score: {score}")
        
    except Exception as e:
        print(f"❌ Error on {row['transaction_id']}: {e}")
    
    time.sleep(0.3)  # Rate limiting

# Final evaluation
results_df = pd.DataFrame(results)
total = len(results_df)
correct = len(results_df[results_df['actual'] == results_df['predicted']])
fraud_caught = len(results_df[(results_df['actual'] == 1) & (results_df['predicted'] == 1)])
total_fraud = len(results_df[results_df['actual'] == 1])

print("\n" + "="*60)
print(f"TOTAL TRANSACTIONS: {total}")
print(f"OVERALL ACCURACY:   {correct}/{total} ({(correct/total)*100:.1f}%)")
print(f"FRAUD DETECTION:    {fraud_caught}/{total_fraud} ({(fraud_caught/total_fraud)*100:.1f}%)")
print("="*60)

results_df.to_csv("llm_evaluation_results.csv", index=False)
print("✅ Detailed results saved to llm_evaluation_results.csv")