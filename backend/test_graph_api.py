# test_graph_api.py
import requests
import json

url = "http://127.0.0.1:8000/graph-score"

# Create a dummy feature vector of 132 zeros
# (In reality, these would be calculated from transaction history)
dummy_features = [0.0] * 132 

payload = {
    "feature_vector": dummy_features
}

print("🚀 Sending request to /graph-score...")
response = requests.post(url, json=payload)

if response.status_code == 200:
    print("✅ Success!")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"❌ Error {response.status_code}: {response.text}")