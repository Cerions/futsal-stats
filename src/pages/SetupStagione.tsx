import { useParams } from 'react-router-dom'

export default function SetupStagione() {
  const { id } = useParams()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Setup stagione #{id}</h1>
      <p className="text-slate-400 mt-2">Qui andranno rosa e avversari (sessione 3)</p>
    </div>
  )
}