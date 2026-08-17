import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import AuthProvider from './contexts/AuthProvider.jsx'
import DialogProvider from './contexts/DialogProvider.jsx'
import ThemeProvider from './contexts/ThemeProvider.jsx'
import './styles/main.css'
import './styles/theme.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <DialogProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </DialogProvider>
    </ThemeProvider>
  </StrictMode>,
)
