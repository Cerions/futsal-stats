import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SetupStagione from './pages/SetupStagione'
import Dashboard from './pages/Dashboard'
import Partita from './pages/Partita'
import UpdatePrompt from './components/UpdatePrompt'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup-stagione/:id" element={<SetupStagione />} />
          <Route path="/stagione/:id" element={<Dashboard />} />
          <Route path="/partita/:id" element={<Partita />} />
        </Routes>
        <UpdatePrompt />
      </div>
    </BrowserRouter>
  )
}