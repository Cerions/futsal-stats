import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <h1 className="text-3xl font-bold mb-8">Futsal Stats</h1>
      <button
        onClick={() => alert('TODO: crea nuova stagione')}
        className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-500 py-4 rounded-lg font-semibold"
      >
        Nuova stagione
      </button>
      <button
        onClick={() => alert('TODO: lista stagioni esistenti')}
        className="w-full max-w-xs bg-slate-700 hover:bg-slate-600 py-4 rounded-lg font-semibold"
      >
        Carica stagione
      </button>
    </div>
  )
}