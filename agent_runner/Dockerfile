FROM python:3.11-slim
WORKDIR /app
COPY agent_runner/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY data/seed/generate_large_csvs.py ./generate_large_csvs.py
COPY data/policies/ ./data/policies/
COPY data/policies/policy_parser.py ./policy_parser.py
COPY agent_runner/main.py .
COPY agent_runner/refresh_data.py .
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
