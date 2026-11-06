# TB & Pneumonia AI System

An intelligent medical screening system powered by Deep Learning (DenseNet121) to detect Tuberculosis and Pneumonia from chest X-ray images.

## Project Structure
- `backend/`: FastAPI application providing prediction API and history management.
- `frontend/`: React + Tailwind CSS modern dashboard with glassmorphism design.
- `database/`: PostgreSQL schema and migration scripts.
- `docker/`: Containerization setup for easy deployment.

## Features
- **Instant Analysis**: Real-time X-ray processing using PyTorch.
- **Modern UI**: Sleek, responsive dashboard with glassmorphism effects.
- **History Tracking**: Keep track of previous screenings and results.
- **Secure**: Built with FastAPI and PostgreSQL for robust data management.

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL

### Local Development

#### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. `python run.py`

#### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Docker Deployment
1. `cd docker`
2. `docker-compose up --build`

## License
MIT
