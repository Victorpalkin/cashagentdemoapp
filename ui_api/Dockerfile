FROM python:3.11-slim
WORKDIR /app
COPY ui_api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY data/policies/ ./data/policies/
COPY ui_api/main.py ./main.py
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
