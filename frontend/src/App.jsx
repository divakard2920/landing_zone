import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import ProjectDetail from './pages/ProjectDetail';
import Login from './pages/Login';
import CapybaraAvatar from './components/CapybaraAvatar';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <CapybaraAvatar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/projects/:id" element={
          <ProtectedRoute>
            <ProjectDetail />
          </ProtectedRoute>
        } />
        <Route path="/admin/*" element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
