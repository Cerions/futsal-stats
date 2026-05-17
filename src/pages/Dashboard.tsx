import { useParams } from 'react-router-dom'

export default function Dashboard() {
  const { id } = useParams()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Stagione #{id}</h1>
    </div>
  )
}