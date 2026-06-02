-- ════════════════════════════════════════════════════════════════
--  La Pastora — Estado compartido entre tiendas (Camino A)
--  Correr UNA sola vez en Supabase: Panel → SQL Editor → Run
--
--  Esta tabla guarda TODO el estado de la app (productos, inventario,
--  ventas, compras, merma, traslados, movimientos, caja) como un único
--  documento JSON. El HTML lo lee al arrancar y lo reescribe en cada
--  cambio, y se sincroniza en vivo entre las dos tiendas vía Realtime.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.app_estado (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  origin      text,                          -- id del dispositivo que escribió (evita eco)
  updated_at  timestamptz not null default now()
);

-- Mantener updated_at al día en cada UPDATE
create or replace function public.fn_app_estado_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_app_estado_touch on public.app_estado;
create trigger trg_app_estado_touch
  before update on public.app_estado
  for each row execute function public.fn_app_estado_touch();

-- ── Seguridad ──────────────────────────────────────────────────
-- La app no usa login real (entra por perfil), así que la llave anon
-- necesita poder leer y escribir esta fila. Política permisiva.
alter table public.app_estado enable row level security;

drop policy if exists "app_estado acceso total" on public.app_estado;
create policy "app_estado acceso total"
  on public.app_estado
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ── Realtime (sincronización en vivo entre las 2 tiendas) ──────
do $$
begin
  alter publication supabase_realtime add table public.app_estado;
exception
  when duplicate_object then null;   -- ya estaba agregada
  when undefined_object then null;   -- por si la publicación no existe en este proyecto
end $$;

-- Fila inicial vacía (el HTML la sobrescribe con sus datos)
insert into public.app_estado (id, data)
values ('lp_main', '{}'::jsonb)
on conflict (id) do nothing;
