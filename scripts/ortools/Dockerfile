FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py optimize.py ./

ENV ORTOOLS_MAX_TIME_SECONDS=30
EXPOSE 8010

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/health')"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]
