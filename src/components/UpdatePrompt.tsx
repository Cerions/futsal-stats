import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      console.log('Service worker registrato:', swUrl)
    },
    onRegisterError(error) {
      console.error('Errore registrazione SW:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-emerald-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center gap-3">
      <div className="flex-1">
        <p className="font-semibold">Aggiornamento disponibile</p>
        <p className="text-sm opacity-90">Una nuova versione dell'app è pronta.</p>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-white text-emerald-700 px-3 py-1.5 rounded font-semibold text-sm"
      >
        Aggiorna
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-white/80 hover:text-white text-lg"
      >
        ×
      </button>
    </div>
  )
}