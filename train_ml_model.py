# train_ml_model.py
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, classification_report

# 1. Load the synthetic dataset
df = pd.read_csv("fraud_dataset.csv")

# 2. Define Features (X) and Target (y) - FIXED COLUMN NAMES
features = ['amount', 'velocity_1h', 'account_age_days', 'is_new_device', 'ip_is_proxy', 
            'merchant_country', 'customer_country', 'merchant_category']
target = 'is_fraud'

X = df[features]
y = df[target]

# 3. Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. Create a Preprocessing Pipeline
numeric_features = ['amount', 'velocity_1h', 'account_age_days']
categorical_features = ['merchant_country', 'customer_country', 'merchant_category']

preprocessor = ColumnTransformer(
    transformers=[
        ('num', StandardScaler(), numeric_features),
        ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
    ])

# 5. Build the Full Pipeline (Preprocessor + XGBoost)
model_pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('classifier', XGBClassifier(n_estimators=100, max_depth=3, learning_rate=0.1, eval_metric='logloss'))
])

# 6. Train the Model
print("Training XGBoost model...")
model_pipeline.fit(X_train, y_train)

# 7. Evaluate
y_pred = model_pipeline.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred) * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# 8. Save the trained pipeline to a file
joblib.dump(model_pipeline, "backend/ml_engine/model_pipeline.pkl")
print("\n✅ Model successfully trained and saved to backend/ml_engine/model_pipeline.pkl")