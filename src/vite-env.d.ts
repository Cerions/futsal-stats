/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del progetto Supabase. Se manca, la sincronizzazione resta spenta. */
  readonly VITE_SUPABASE_URL?: string
  /** Chiave anon (pubblica) di Supabase: a proteggere i dati sono le policy RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'virtual:pwa-register/react' {
  import type { Dispatch, SetStateAction } from 'react'

  type RegisterSWOptions = {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegisteredSW?: (swScriptUrl: string, registration?: ServiceWorkerRegistration) => void
    onRegisterError?: (error: unknown) => void
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>]
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>]
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }
}