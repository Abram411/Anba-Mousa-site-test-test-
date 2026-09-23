import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { StageProvider } from './context/StageContext';
import { AudioProvider } from './context/AudioContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <StageProvider>
          <AudioProvider>
            <App />
          </AudioProvider>
        </StageProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
