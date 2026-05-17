import { useParams } from 'react-router-dom'

export default function Partita() {
  const { id } = useParams()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Partita #{id}</h1>
      <p className="text-slate-400 mt-2">Cronometro, eventi, cambi (sessione 5)</p>
    </div>
  )
}