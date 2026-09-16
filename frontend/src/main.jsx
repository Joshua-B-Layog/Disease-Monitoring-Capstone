import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ResidentApp from './ResidentApp.jsx'
import ResetPasswordLanding from './components/ResetPasswordLanding.jsx'
import Verify2FALanding from './components/Verify2FALanding';
import { I18nProvider } from './i18n';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordLanding />} />
        <Route path="/verify-2fa" element={<Verify2FALanding />} />
        <Route path="/CHO/*" element={<I18nProvider scope="app"><App /></I18nProvider>} />
        <Route path="/Resident/*" element={<I18nProvider scope="resident"><ResidentApp /></I18nProvider>} />
        <Route path="/*" element={<I18nProvider scope="app"><App /></I18nProvider>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)