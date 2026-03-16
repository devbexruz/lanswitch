import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <ul style={{ listStyle: 'none', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/about">About</Link></li>
        </ul>
      </nav>

      <main style={{ padding: '1rem' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
