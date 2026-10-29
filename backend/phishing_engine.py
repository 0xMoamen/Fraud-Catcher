"""
Phishing Website Detection Engine
Extracts 26 features from URLs and predicts phishing using Random Forest
"""
import re
import joblib
import os
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from sklearn.pipeline import Pipeline
import warnings
warnings.filterwarnings("ignore")

# Load model and feature names
MODEL_PATH = os.path.join(os.path.dirname(__file__), "phishing_rf_model.pkl")
FEATURES_PATH = os.path.join(os.path.dirname(__file__), "phishing_feature_names.pkl")

phishing_model = joblib.load(MODEL_PATH)
feature_names = joblib.load(FEATURES_PATH)

# 🔧 FIX: If it's a Pipeline, extract the actual model for feature_importances_
if isinstance(phishing_model, Pipeline):
    # Try common step names: 'model', 'classifier', 'randomforest', etc.
    actual_model = None
    for step_name in ['model', 'classifier', 'randomforest', 'rf']:
        if step_name in phishing_model.named_steps:
            actual_model = phishing_model.named_steps[step_name]
            break
    if actual_model is None:
        # Fallback: take the last step
        actual_model = phishing_model.steps[-1][1]
    
    # Store both: pipeline for predict, actual_model for feature_importances_
    predict_model = phishing_model
    importance_model = actual_model
else:
    predict_model = phishing_model
    importance_model = phishing_model

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
SHORTENERS = {"bit.ly", "goo.gl", "tinyurl.com", "t.co", "ow.ly", "is.gd", "buff.ly", "adf.ly", "bit.do", "cutt.ly"}


def extract_features(url: str) -> dict:
    """Extract all 26 features from a URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        
        # Fetch HTML
        html = ""
        try:
            resp = requests.get(url, headers=HEADERS, timeout=5, allow_redirects=True, verify=False)
            html = resp.text
        except:
            pass
        
        soup = BeautifulSoup(html, "html.parser") if html else None
        
        features = {}
        
        features["having_ip_address"] = 1 if re.search(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", domain) else -1
        features["url_length"] = 1 if len(url) < 54 else (0 if len(url) <= 75 else -1)
        features["shortining_service"] = -1 if any(s in url for s in SHORTENERS) else 1
        features["having_at_symbol"] = -1 if "@" in url else 1
        features["double_slash_redirecting"] = -1 if url.rfind("//") > 7 else 1
        features["prefix_suffix"] = -1 if "-" in domain else 1
        
        parts = domain.split(".")
        features["having_sub_domain"] = -1 if len(parts) > 3 else (0 if len(parts) == 3 else 1)
        
        features["sslfinal_state"] = 1 if url.startswith("https") else -1
        features["domain_registration_length"] = -1
        features["favicon"] = -1 if (soup and not soup.find("link", rel="icon")) else 1
        features["port"] = -1 if ":" in domain else 1
        features["https_token"] = -1 if "https" in parsed.path else 1
        
        if soup:
            imgs = soup.find_all(["img", "script", "link"], src=True)
            external = sum(1 for t in imgs if t.get("src", "").startswith("http") and domain not in t["src"])
            features["request_url"] = -1 if len(imgs) > 0 and external/len(imgs) > 0.22 else 1
        else:
            features["request_url"] = 0
        
        if soup:
            anchors = soup.find_all("a", href=True)
            unsafe = sum(1 for a in anchors if not a["href"] or a["href"].startswith(("#", "javascript", "mailto")) or (a["href"].startswith("http") and domain not in a["href"]))
            features["url_of_anchor"] = -1 if len(anchors) > 0 and unsafe/len(anchors) > 0.31 else 1
        else:
            features["url_of_anchor"] = 0
        
        if soup:
            tags = soup.find_all(["meta", "link", "script"])
            external = sum(1 for t in tags if t.get("href", "").startswith("http") and domain not in t.get("href", ""))
            features["links_in_tags"] = -1 if len(tags) > 0 and external/len(tags) > 0.17 else 1
        else:
            features["links_in_tags"] = 0
        
        if soup:
            forms = soup.find_all("form")
            features["sfh"] = -1 if any(domain not in f.get("action", "") for f in forms if f.get("action")) else 1
        else:
            features["sfh"] = 0
        
        features["submitting_to_email"] = -1 if "mailto:" in (html or "") else 1
        features["abnormal_url"] = -1 if domain not in (html or "")[:500] else 1
        features["redirect"] = 0 if (html or "").count("<meta http-equiv=\"refresh\"") <= 1 else -1
        features["on_mouseover"] = -1 if "onMouseOver" in (html or "") else 1
        features["rightclick"] = -1 if "oncontextmenu" in (html or "").lower() else 1
        features["popupwindow"] = -1 if "window.open" in (html or "") else 1
        features["iframe"] = -1 if "<iframe" in (html or "") else 1
        features["age_of_domain"] = -1
        features["dnsrecord"] = -1
        features["web_traffic"] = -1
        
        return features
        
    except Exception as e:
        print(f"Feature extraction error: {e}")
        return {name: 0 for name in feature_names}


def predict_phishing(url: str) -> dict:
    """Main prediction function."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    
    features = extract_features(url)
    feature_array = [[features.get(name, 0) for name in feature_names]]
    
    # Use the pipeline for prediction (Pipelines have .predict and .predict_proba)
    prediction = predict_model.predict(feature_array)[0]
    probability = predict_model.predict_proba(feature_array)[0]
    
    # Use the actual model for feature importances
    feature_importance = dict(zip(feature_names, importance_model.feature_importances_))
    top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:3]
    
    return {
        "url": url,
        "prediction": "phishing" if prediction == 1 else "legitimate",
        "confidence": float(max(probability)),
        "phishing_probability": float(probability[1]) if len(probability) > 1 else 0.0,
        "legitimate_probability": float(probability[0]) if len(probability) > 1 else 0.0,
        "top_features": [{"name": name, "importance": round(float(imp), 4)} for name, imp in top_features],
        "features_used": features
    }