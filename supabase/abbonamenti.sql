-- ===========================================================================
-- Futsal Stats — abbonamenti (piano Premium)
--
-- Una riga per account Premium, riconosciuto dall'email. Le righe si
-- scrivono SOLO dalla dashboard di Supabase (Table Editor o SQL Editor):
-- l'app può leggere la propria riga e basta, quindi nessuno si promuove da sé.
--
--   scade_il null        → Premium senza scadenza (il tuo account)
--   scade_il nel futuro  → Premium fino a quella data (prova, mese pagato…)
--   scade_il nel passato → piano gratuito
--   nessuna riga         → piano gratuito
--
-- Piano gratuito: una partita sola. Con più di una partita si può solo
-- guardare; per registrarne un'altra bisogna eliminare quelle che ci sono.
-- Niente download del backup.
--
-- Il limite lo applica l'app, che lavora offline. Qui sotto c'è anche il
-- controllo lato server: chi non è Premium non può caricare sul cloud
-- stagioni che in tutto superano una partita, anche se si modifica l'app.
--
-- Da eseguire nel SQL Editor di Supabase, DOPO schema.sql. Si può rieseguire.
-- PRIMA di pubblicare l'app nuova inserisci la riga del tuo account (vedi in
-- fondo), altrimenti la tua sincronizzazione si ferma.
-- ===========================================================================

-- Stessa funzione di voti.sql: ridefinirla uguale non cambia niente, e così
-- questo file funziona anche da solo.
create or replace function public.mia_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create table if not exists public.abbonamenti (
  email     text primary key check (email = lower(email)),
  piano     text not null default 'premium',
  scade_il  timestamptz,
  note      text,
  creato_il timestamptz not null default now()
);

comment on table public.abbonamenti is
  'Account Premium. Si modifica solo dalla dashboard: l''app legge la propria riga.';
comment on column public.abbonamenti.scade_il is
  'null = senza scadenza. Per bloccare un account: una data passata, o elimina la riga.';

alter table public.abbonamenti enable row level security;

-- Solo lettura per gli utenti: niente insert/update/delete da app.
grant select on public.abbonamenti to authenticated;
grant select, insert, update, delete on public.abbonamenti to service_role;

drop policy if exists "abbonamenti: ognuno legge il suo" on public.abbonamenti;
create policy "abbonamenti: ognuno legge il suo" on public.abbonamenti
  for select to authenticated
  using (email = mia_email());

-- ---------------------------------------------------------------------------
-- Funzioni per le policy
-- ---------------------------------------------------------------------------
create or replace function public.e_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from abbonamenti
    where email = mia_email()
      and (scade_il is null or scade_il > now())
  )
$$;

/** Partite che l'utente ha sul cloud nelle sue stagioni, esclusa `sid`. */
create or replace function public.partite_altre_stagioni(sid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case when jsonb_typeof(dati -> 'partite') = 'array'
         then jsonb_array_length(dati -> 'partite') else 0 end
  ), 0)::integer
  from stagioni_cloud
  where proprietario = auth.uid()
    and id is distinct from sid
$$;

create or replace function public.partite_nel_blob(dati jsonb)
returns integer
language sql
immutable
as $$
  select case when jsonb_typeof(dati -> 'partite') = 'array'
              then jsonb_array_length(dati -> 'partite') else 0 end
$$;

-- ---------------------------------------------------------------------------
-- Limite del piano gratuito sul cloud
--
-- Policy RESTRICTIVE: si sommano alle altre in AND, quindi non allargano
-- niente, stringono soltanto. Chi è Premium passa sempre; gli altri possono
-- caricare finché, contando tutte le loro stagioni, le partite sono al
-- massimo una. Eliminare dal cloud resta sempre possibile.
-- ---------------------------------------------------------------------------
drop policy if exists "piano gratuito: inserisce" on public.stagioni_cloud;
create policy "piano gratuito: inserisce" on public.stagioni_cloud
  as restrictive
  for insert to authenticated
  with check (
    e_premium()
    or partite_altre_stagioni(id) + partite_nel_blob(dati) <= 1
  );

drop policy if exists "piano gratuito: aggiorna" on public.stagioni_cloud;
create policy "piano gratuito: aggiorna" on public.stagioni_cloud
  as restrictive
  for update to authenticated
  using (true)
  with check (
    e_premium()
    or partite_altre_stagioni(id) + partite_nel_blob(dati) <= 1
  );

-- ===========================================================================
-- Comandi da usare a mano (SQL Editor). Sostituisci le email.
--
-- Il tuo account, Premium per sempre:
--   insert into abbonamenti (email, scade_il, note)
--   values ('tua@email.it', null, 'proprietario')
--   on conflict (email) do update set scade_il = null;
--
-- Prova fino a lunedì mattina:
--   insert into abbonamenti (email, scade_il, note)
--   values ('collega@email.it', '2026-11-02 09:00+01', 'prova weekend')
--   on conflict (email) do update set scade_il = excluded.scade_il;
--
-- Bloccare subito:
--   update abbonamenti set scade_il = now() where email = 'collega@email.it';
--
-- Riattivare senza scadenza:
--   update abbonamenti set scade_il = null where email = 'collega@email.it';
--
-- Chi è Premium adesso:
--   select email, scade_il, (scade_il is null or scade_il > now()) as attivo
--   from abbonamenti order by email;
-- ===========================================================================
