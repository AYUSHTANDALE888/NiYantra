FROM python:3.11-slim
WORKDIR /app
COPY formcheck/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY shared /shared
COPY formcheck/ /app/
ENV SHARED_DIR=/shared
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
