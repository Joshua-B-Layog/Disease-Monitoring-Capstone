import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ResidentApp from './ResidentApp.jsx'
import ResetPasswordLanding from './components/ResetPasswordLanding.jsx'
import Verify2FALanding from './components/Verify2FALanding';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordLanding />} />
        <Route path="/verify-2fa" element={<Verify2FALanding />} />
        <Route path="/CHO/*" element={<App />} />
        <Route path="/Resident/*" element={<ResidentApp />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)