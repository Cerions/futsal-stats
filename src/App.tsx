import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SetupStagione from './pages/SetupStagione'
import Dashboard from './pages/Dashboard'
import Partita from './pages/Partita'
import UpdatePrompt from './components/UpdatePrompt'
import ModificaPartita from './pages/ModificaPartita'
import StatisticheStagione from './pages/StatisticheStagione'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup-stagione/:id" element={<SetupStagione />} />
          <Route path="/stagione/:id" element={<Dashboard />} />
          <Route path="/stagione/:id/statistiche" element={<StatisticheStagione />} />
          <Route path="/partita/:id" element={<Partita />} />
          <Route path="/partita/:id/modifica" element={<ModificaPartita />} />
        </Routes>
        <UpdatePrompt />
      </div>
    </BrowserRouter>
  )
}