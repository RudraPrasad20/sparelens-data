// frontend/src/lib/api.ts - NO AUTH SYSTEM
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Your FastAPI backend URL

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Removed getUserId, setUserId, clearUserId as there is no user management for now.

export default api;