-- ===========================================================================
-- Futsal Stats — schema di sincronizzazione
--
-- Una riga per stagione: il campo `dati` contiene l'export JSON completo
-- (giocatori, avversari, schemi, partite, eventi). La sincronizzazione è a
-- livello di stagione intera, con `versione` usato come lock ottimistico:
-- chi scrive deve dichiarare quale versione sta sovrascrivendo, altrimenti
-- l'update non tocca nessuna riga e l'app segnala il conflitto.
--
-- Da eseguire nel SQL Editor di Supabase.
-- ===========================================================================

create table if not exists public.stagioni_cloud (
  id            uuid primary key default gen_random_uuid(),
  proprietario  uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  nome          text not null,
  nome_squadra  text not null,
  versione      integer not null default 1,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da text,
  condivisa_con text[] not null default '{}',
  dati          jsonb not null
);

comment on column public.stagioni_cloud.versione is
  'Lock ottimistico: ogni push incrementa di 1 e deve dichiarare la versione attesa.';
comment on column public.stagioni_cloud.aggiornato_da is
  'Etichetta del dispositivo che ha fatto l''ultimo push, per capire da dove arriva.';
comment on column public.stagioni_cloud.condivisa_con is
  'Email che possono leggere la stagione in sola lettura.';

create index if not exists stagioni_cloud_proprietario_idx
  on public.stagioni_cloud (proprietario);

alter table public.stagioni_cloud enable row level security;

-- ---------------------------------------------------------------------------
-- Il proprietario può fare tutto sulle proprie stagioni
-- ---------------------------------------------------------------------------
drop policy if exists "proprietario legge" on public.stagioni_cloud;
create policy "proprietario legge" on public.stagioni_cloud
  for select to authenticated
  using (auth.uid() = proprietario);

drop policy if exists "proprietario inserisce" on public.stagioni_cloud;
create policy "proprietario inserisce" on public.stagioni_cloud
  for insert to authenticated
  with check (auth.uid() = proprietario);

drop policy if exists "proprietario aggiorna" on public.stagioni_cloud;
create policy "proprietario aggiorna" on public.stagioni_cloud
  for update to authenticated
  using (auth.uid() = proprietario)
  with check (auth.uid() = proprietario);

drop policy if exists "proprietario elimina" on public.stagioni_cloud;
create policy "proprietario elimina" on public.stagioni_cloud
  for delete to authenticated
  using (auth.uid() = proprietario);

-- ---------------------------------------------------------------------------
-- Chi è nella lista di condivisione può SOLO leggere
-- ---------------------------------------------------------------------------
drop policy if exists "condivisi leggono" on public.stagioni_cloud;
create policy "condivisi leggono" on public.stagioni_cloud
  for select to authenticated
  using (lower(auth.jwt() ->> 'email') = any (condivisa_con));

-- ---------------------------------------------------------------------------
-- aggiornato_il si mantiene da solo
-- ---------------------------------------------------------------------------
create or replace function public.tocca_aggiornato_il()
returns trigger
language plpgsql
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

drop trigger if exists stagioni_cloud_tocca on public.stagioni_cloud;
create trigger stagioni_cloud_tocca
  before update on public.stagioni_cloud
  for each row execute function public.tocca_aggiornato_il();
