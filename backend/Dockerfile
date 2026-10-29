FROM python:3.10-slim

WORKDIR /app

# 1. Upgrade pip to prevent metadata/name inconsistency bugs
RUN pip install --upgrade pip

# 2. Install system dependencies
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# 3. Install CPU-only PyTorch (using extra-index-url allows fallback to standard PyPI for dependencies)
RUN pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cpu

# 4. Install the rest of your app dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy your application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "orchestrator:app", "--host", "0.0.0.0", "--port", "8000"]