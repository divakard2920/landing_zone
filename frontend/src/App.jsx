import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import ProjectDetail from './pages/ProjectDetail';
import Login from './pages/Login';
import CapybaraAvatar from './components/CapybaraAvatar';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

const ProtectedRoute = () => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const Layout = ({ children }) => (
  <>
    <CapybaraAvatar />
    {children}
  </>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout><Landing /></Layout>,
  },
  {
    path: '/login',
    element: <Layout><Login /></Layout>,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/admin/projects/:id',
        element: <Layout><ProjectDetail /></Layout>,
      },
      {
        path: '/admin/*',
        element: <Layout><Admin /></Layout>,
      },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
