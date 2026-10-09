# RestroIQ - Restaurant Operations Intelligence Platform

RestroIQ is a comprehensive intelligence platform designed to forecast and analyze restaurant demand across multiple centers, cuisines, and cities.

## Project Structure

- `frontend/`: React + Vite + Tailwind application serving the UI.
- `backend/`: FastAPI Python backend serving processed metrics and datasets.
- `data/`: Processed CSV files, feature importances, and historical data used by the backend.
- `models/`: Trained machine learning artifacts (XGBoost/RandomForest).
- `ml_pipeline/`: Data processing and forecasting scripts.

## Installation & Setup

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # On Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Running Production Build
```bash
cd frontend
npm run build
npm run preview
```