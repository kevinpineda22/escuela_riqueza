import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AdminVideoUpload from './pages/AdminVideoUpload';
import LessonViewer from './pages/LessonViewer';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VIPLiveRoom from './pages/VIPLiveRoom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/leccion" element={<LessonViewer />} />
        <Route path="/admin/upload" element={<AdminVideoUpload />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vip-live" element={<VIPLiveRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;