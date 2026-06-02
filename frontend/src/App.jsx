import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import CapybaraAvatar from './components/CapybaraAvatar';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <CapybaraAvatar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin/*" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
