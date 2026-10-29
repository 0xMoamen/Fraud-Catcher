import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

np.random.seed(42)
random.seed(42)

def generate_dataset(num_rows=200):
    data = []
    
    merchant_categories = ["Grocery", "Electronics", "Travel", "Crypto Exchange", "Gambling", "Software", "Gas Station"]
    countries = ["US", "UK", "CA", "DE", "NG", "RU", "BR", "SG"]
    
    for i in range(num_rows):
        # 20% fraud rate
        is_fraud = random.choice([0, 0, 0, 0, 1])
        
        if is_fraud:
            # FRAUD PATTERN 1: Mule Drain (new account, huge transfer, foreign/crypto)
            if random.random() > 0.5:
                amount = round(random.uniform(5000, 15000), 2)
                merchant_cat = random.choice(["Crypto Exchange", "Electronics"])
                merchant_country = random.choice(["NG", "RU", "BR"])
                customer_country = "US"
                account_age_days = random.randint(1, 14)
                velocity_1h = random.randint(3, 8)
                is_new_device = True
                ip_is_proxy = True
                tx_type = "Transfer"
            # FRAUD PATTERN 2: Card Testing (low amount, high velocity, proxy)
            else:
                amount = round(random.uniform(1.00, 15.00), 2)
                merchant_cat = "Software"
                merchant_country = random.choice(["RU", "SG", "BR"])
                customer_country = "US"
                account_age_days = random.randint(0, 30)
                velocity_1h = random.randint(10, 25)
                is_new_device = True
                ip_is_proxy = True
                tx_type = "Purchase"
        else:
            # NORMAL: established user, local, normal behavior
            amount = round(random.uniform(10.00, 250.00), 2)
            merchant_cat = random.choice(["Grocery", "Gas Station", "Travel", "Software"])
            customer_country = random.choice(["US", "UK", "CA"])
            merchant_country = customer_country  # Local transaction
            account_age_days = random.randint(100, 2000)
            velocity_1h = random.randint(1, 3)
            is_new_device = random.choice([True, False, False, False])
            ip_is_proxy = False
            tx_type = random.choice(["Purchase", "Transfer", "Withdrawal"])

        # Timestamp (fraud often at weird hours)
        hour = random.choice([3, 4, 5]) if is_fraud else random.randint(8, 22)
        tx_time = (datetime.now() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))).replace(hour=hour, minute=random.randint(0,59))

        data.append({
            "transaction_id": f"TX_{10000 + i}",
            "timestamp": tx_time.strftime("%Y-%m-%d %H:%M:%S"),
            "amount": amount,
            "currency": "USD",
            "transaction_type": tx_type,
            "merchant_category": merchant_cat,
            "merchant_country": merchant_country,
            "customer_country": customer_country,
            "account_age_days": account_age_days,
            "velocity_1h": velocity_1h,
            "is_new_device": is_new_device,
            "ip_is_proxy": ip_is_proxy,
            "is_fraud": is_fraud
        })
        
    return pd.DataFrame(data)

if __name__ == "__main__":
    df = generate_dataset(200)
    df.to_csv("fraud_dataset.csv", index=False)
    print("✅ Dataset generated: fraud_dataset.csv")
    print(f"Total rows: {len(df)}")
    print(f"Fraud cases: {df['is_fraud'].sum()} ({(df['is_fraud'].sum()/len(df)*100):.1f}%)")