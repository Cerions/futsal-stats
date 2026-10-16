-- ===========================================================================
-- Futsal Stats — voti degli allenatori
--
-- I voti NON stanno nel blob della stagione: li scrivono più persone, ognuna
-- dal suo account, mentre il blob ha un solo proprietario e chi lo riceve in
-- condivisione può solo leggerlo. Qui ogni voto è una riga a sé, e i permessi
-- li decide il server riga per riga.
--
-- Giocatori e partite si riconoscono dallo `uid` (stabile su tutti i
-- dispositivi), non dall'id locale che cambia a ogni download.
--
--   valutatori   chi dà i voti in una stagione: un nome e l'email del suo
--                account (o nessuna, per chi c'è solo nello storico).
--                `attivo` false = ex allenatore: i suoi voti restano.
--                Si gestiscono dall'app in Sincronizzazione → persone della
--                stagione, insieme alla condivisione in sola lettura.
--                `delegati` sono le email di chi può inserire i voti AL POSTO
--                SUO (l'allenatore che li segna per il collega).
--   voti         un voto (e/o una nota) di un valutatore a un giocatore in
--                una partita. Al massimo uno per terna.
--
-- Chi vede: chiunque veda la stagione (proprietario e condivisi).
-- Chi scrive un voto: il valutatore stesso, i suoi delegati, il proprietario.
-- Chi gestisce i valutatori: solo il proprietario.
--
-- Da eseguire nel SQL Editor di Supabase, DOPO schema.sql. Si può rieseguire.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Funzioni di supporto per le policy
--
-- security definer: leggono stagioni_cloud e valutatori senza passare dalle
-- loro policy, così una policy non ne richiama un'altra in cerchio. Rispondono
-- solo sì/no sull'utente che chiama, non espongono dati.
-- ---------------------------------------------------------------------------
create or replace function public.mia_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.e_proprietario(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from stagioni_cloud
    where id = sid and proprietario = auth.uid()
  )
$$;

create or replace function public.puo_leggere_stagione(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from stagioni_cloud
    where id = sid
      and (proprietario = auth.uid() or mia_email() = any (condivisa_con))
  )
$$;

-- ---------------------------------------------------------------------------
-- Valutatori
-- ---------------------------------------------------------------------------
create table if not exists public.valutatori (
  id             uuid primary key default gen_random_uuid(),
  stagione_cloud uuid not null
                 references public.stagioni_cloud (id) on delete cascade,
  nome           text not null,
  -- null = allenatore «solo storico», senza account: tiene i voti importati
  email          text check (email = lower(email)),
  delegati       text[] not null default '{}',
  -- false = ex allenatore: non vota più, ma i suoi voti restano nelle medie
  attivo         boolean not null default true,
  creato_il      timestamptz not null default now(),
  unique (stagione_cloud, email)
);

-- Per chi ha eseguito la prima versione di questo file, quando l'email era
-- obbligatoria. Su una tabella appena creata non cambia niente.
alter table public.valutatori alter column email drop not null;
alter table public.valutatori add column if not exists attivo boolean not null default true;

comment on column public.valutatori.delegati is
  'Email di chi può inserire i voti al posto di questo valutatore.';

create index if not exists valutatori_stagione_idx
  on public.valutatori (stagione_cloud);

alter table public.valutatori enable row level security;

-- Questa sta qui e non con le altre funzioni perché legge `valutatori`:
-- Postgres controlla il corpo quando la crea, e la tabella deve già esistere.
create or replace function public.puo_votare_per(vid uuid, sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Il proprietario può correggere tutto, anche i voti degli ex e dello
  -- storico. Gli altri votano solo per un allenatore attivo: per sé, o per un
  -- collega che li ha come delegati — e solo se sono allenatori attivi anche
  -- loro, così chi passa a sola lettura perde anche le deleghe.
  select e_proprietario(sid)
      or (
        puo_leggere_stagione(sid)
        and exists (
          select 1 from valutatori v
          where v.id = vid
            and v.stagione_cloud = sid
            and v.attivo
            and (
              v.email = mia_email()
              or (
                mia_email() = any (v.delegati)
                and exists (
                  select 1 from valutatori io
                  where io.stagione_cloud = sid
                    and io.email = mia_email()
                    and io.attivo
                )
              )
            )
        )
      )
$$;

grant select, insert, update, delete on public.valutatori to authenticated;
grant select, insert, update, delete on public.valutatori to service_role;

drop policy if exists "valutatori: legge chi vede la stagione" on public.valutatori;
create policy "valutatori: legge chi vede la stagione" on public.valutatori
  for select to authenticated
  using (puo_leggere_stagione(stagione_cloud));

drop policy if exists "valutatori: inserisce il proprietario" on public.valutatori;
create policy "valutatori: inserisce il proprietario" on public.valutatori
  for insert to authenticated
  with check (e_proprietario(stagione_cloud));

drop policy if exists "valutatori: aggiorna il proprietario" on public.valutatori;
create policy "valutatori: aggiorna il proprietario" on public.valutatori
  for update to authenticated
  using (e_proprietario(stagione_cloud))
  with check (e_proprietario(stagione_cloud));

drop policy if exists "valutatori: elimina il proprietario" on public.valutatori;
create policy "valutatori: elimina il proprietario" on public.valutatori
  for delete to authenticated
  using (e_proprietario(stagione_cloud));

-- ---------------------------------------------------------------------------
-- Voti
-- ---------------------------------------------------------------------------
create table if not exists public.voti (
  id             uuid primary key default gen_random_uuid(),
  stagione_cloud uuid not null
                 references public.stagioni_cloud (id) on delete cascade,
  valutatore     uuid not null
                 references public.valutatori (id) on delete cascade,
  partita_uid    text not null,
  giocatore_uid  text not null,
  voto           numeric(4, 2) check (voto is null or (voto >= 0 and voto <= 10)),
  note           text,
  aggiornato_il  timestamptz not null default now(),
  aggiornato_da  text default lower(auth.jwt() ->> 'email'),
  unique (valutatore, partita_uid, giocatore_uid),
  -- una riga vuota non ha senso: o c'è il voto, o c'è almeno una nota
  check (voto is not null or nullif(btrim(note), '') is not null)
);

comment on column public.voti.aggiornato_da is
  'Email di chi ha scritto materialmente il voto: per un delegato non è quella del valutatore.';

create index if not exists voti_stagione_idx on public.voti (stagione_cloud);

alter table public.voti enable row level security;

grant select, insert, update, delete on public.voti to authenticated;
grant select, insert, update, delete on public.voti to service_role;

drop policy if exists "voti: legge chi vede la stagione" on public.voti;
create policy "voti: legge chi vede la stagione" on public.voti
  for select to authenticated
  using (puo_leggere_stagione(stagione_cloud));

drop policy if exists "voti: inserisce chi può votare" on public.voti;
create policy "voti: inserisce chi può votare" on public.voti
  for insert to authenticated
  with check (puo_votare_per(valutatore, stagione_cloud));

drop policy if exists "voti: aggiorna chi può votare" on public.voti;
create policy "voti: aggiorna chi può votare" on public.voti
  for update to authenticated
  using (puo_votare_per(valutatore, stagione_cloud))
  with check (puo_votare_per(valutatore, stagione_cloud));

drop policy if exists "voti: elimina chi può votare" on public.voti;
create policy "voti: elimina chi può votare" on public.voti
  for delete to authenticated
  using (puo_votare_per(valutatore, stagione_cloud));

-- aggiornato_il e aggiornato_da si mantengono da soli a ogni modifica
create or replace function public.tocca_voto()
returns trigger
language plpgsql
as $$
begin
  new.aggiornato_il := now();
  new.aggiornato_da := nullif(mia_email(), '');
  return new;
end;
$$;

drop trigger if exists voti_tocca on public.voti;
create trigger voti_tocca
  before update on public.voti
  for each row execute function public.tocca_voto();
