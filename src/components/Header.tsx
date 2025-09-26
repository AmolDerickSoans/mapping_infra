import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { Globe, Settings, Sun, Moon } from 'lucide-react';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <img
            src="/logo-black-1024x_refined(1)_light_lower_white.png"
            alt="Logo"
            className="header-logo"
          />
        </div>
        <nav className="header-nav">
          <a href="https://www.heliosenergy.io/" className="nav-link" target="_blank" rel="noopener noreferrer">
            <Globe size={18} />
            <span>Site</span>
          </a>
          <a href="https://console.heliosenergy.io/login?tab=signup" className="nav-link" target="_blank" rel="noopener noreferrer">
            <Settings size={18} />
            <span>Console</span>
          </a>
        </nav>
        <div className="header-right">
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;