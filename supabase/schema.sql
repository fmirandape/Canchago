-- ============================================================
-- CanchaGo · Esquema PostgreSQL para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PERFILES (extiende auth.users de Supabase)
-- ============================================================
create table public.perfiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  nombre      text not null,
  telefono    text,
  rol         text not null check (rol in ('dueño', 'cliente')) default 'cliente',
  creado_en   timestamptz default now()
);

alter table public.perfiles enable row level security;

create policy "perfil: ver propio"
  on public.perfiles for select
  using (auth.uid() = id);

create policy "perfil: editar propio"
  on public.perfiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: crea perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfiles (id, nombre, telefono, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce(new.raw_user_meta_data->>'rol', 'cliente')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. CANCHAS
-- ============================================================
create table public.canchas (
  id            uuid default uuid_generate_v4() primary key,
  dueño_id      uuid references public.perfiles(id) on delete cascade not null,
  nombre        text not null,
  slug          text not null unique,
  descripcion   text,
  localidad     text not null,
  direccion     text,
  lat           numeric(10,7),
  lng           numeric(10,7),
  deportes      text[] default '{}',
  precio_hora   integer not null,
  hora_apertura text default '08:00',
  hora_cierre   text default '22:00',
  duracion_min  integer default 60,
  dias_activos  text[] default '{"lun","mar","mie","jue","vie","sab","dom"}',
  luz           boolean default false,
  cubierta      boolean default false,
  parqueadero   text default 'no' check (parqueadero in ('no','si-gratis','si-pago')),
  activa        boolean default true,
  creado_en     timestamptz default now()
);

alter table public.canchas enable row level security;

-- Cualquiera puede ver canchas activas
create policy "canchas: ver activas"
  on public.canchas for select
  using (activa = true);

-- Solo el dueño puede insertar sus canchas
create policy "canchas: dueño inserta"
  on public.canchas for insert
  with check (auth.uid() = dueño_id);

-- Solo el dueño puede actualizar o eliminar sus canchas
create policy "canchas: dueño edita"
  on public.canchas for update
  using (auth.uid() = dueño_id)
  with check (auth.uid() = dueño_id);

create policy "canchas: dueño elimina"
  on public.canchas for delete
  using (auth.uid() = dueño_id);

-- ============================================================
-- 3. DISPONIBILIDAD
-- ============================================================
create table public.disponibilidad (
  id          uuid default uuid_generate_v4() primary key,
  cancha_id   uuid references public.canchas(id) on delete cascade not null,
  fecha       date not null,
  hora        text not null,
  estado      text not null check (estado in ('bloqueado','reservado')) default 'bloqueado',
  reserva_id  uuid,
  creado_en   timestamptz default now(),
  unique (cancha_id, fecha, hora)
);

alter table public.disponibilidad enable row level security;

create policy "disponibilidad: ver"
  on public.disponibilidad for select
  using (true);

create policy "disponibilidad: dueño bloquea"
  on public.disponibilidad for insert
  with check (
    auth.uid() = (select dueño_id from public.canchas where id = cancha_id)
  );

create policy "disponibilidad: dueño desbloquea"
  on public.disponibilidad for delete
  using (
    auth.uid() = (select dueño_id from public.canchas where id = cancha_id)
  );

-- ============================================================
-- 4. RESERVAS
-- ============================================================
create table public.reservas (
  id               uuid default uuid_generate_v4() primary key,
  codigo           text not null unique,
  cancha_id        uuid references public.canchas(id) on delete restrict not null,
  cliente_id       uuid references public.perfiles(id) on delete set null,
  cliente_nombre   text not null,
  cliente_telefono text,
  cliente_email    text,
  fecha            date not null,
  hora             text not null,
  duracion_min     integer not null default 60,
  monto            integer not null,
  metodo_pago      text check (metodo_pago in ('pse','nequi','tarjeta')),
  estado           text not null check (estado in ('pendiente','confirmada','cancelada')) default 'pendiente',
  pago_id          text,
  creado_en        timestamptz default now()
);

alter table public.reservas enable row level security;

create policy "reservas: cliente ve las suyas"
  on public.reservas for select
  using (auth.uid() = cliente_id);

create policy "reservas: dueño ve las de su cancha"
  on public.reservas for select
  using (
    auth.uid() = (select dueño_id from public.canchas where id = cancha_id)
  );

-- Cualquiera puede crear una reserva (clientes sin cuenta también)
create policy "reservas: insertar"
  on public.reservas for insert
  with check (true);

create policy "reservas: dueño cancela"
  on public.reservas for update
  using (
    auth.uid() = (select dueño_id from public.canchas where id = cancha_id)
  )
  with check (
    auth.uid() = (select dueño_id from public.canchas where id = cancha_id)
  );

-- FK diferida: disponibilidad.reserva_id → reservas.id
alter table public.disponibilidad
  add constraint fk_disponibilidad_reserva
  foreign key (reserva_id) references public.reservas(id) on delete set null;

-- ============================================================
-- 5. RESEÑAS
-- ============================================================
create table public.reseñas (
  id           uuid default uuid_generate_v4() primary key,
  cancha_id    uuid references public.canchas(id) on delete cascade not null,
  cliente_id   uuid references public.perfiles(id) on delete set null,
  reserva_id   uuid references public.reservas(id) on delete set null,
  calificacion integer not null check (calificacion between 1 and 5),
  comentario   text,
  verificada   boolean default false,
  creado_en    timestamptz default now()
);

alter table public.reseñas enable row level security;

create policy "reseñas: ver todas"
  on public.reseñas for select
  using (true);

create policy "reseñas: cliente crea"
  on public.reseñas for insert
  with check (auth.uid() = cliente_id);

-- ============================================================
-- 6. LISTA DE ESPERA
-- ============================================================
create table public.lista_espera (
  id             uuid default uuid_generate_v4() primary key,
  nombre         text not null,
  whatsapp       text not null,
  nombre_cancha  text,
  localidad      text,
  deportes       text[],
  num_canchas    integer default 1,
  sistema_actual text,
  posicion       serial,
  creado_en      timestamptz default now()
);

alter table public.lista_espera enable row level security;

create policy "lista_espera: insertar"
  on public.lista_espera for insert
  with check (true);

-- ============================================================
-- Función: generar código de reserva CGO-XXXXX
-- ============================================================
create or replace function public.generar_codigo_reserva()
returns text language plpgsql as $$
declare
  codigo text;
  existe boolean;
begin
  loop
    codigo := 'CGO-' || upper(substring(md5(random()::text) from 1 for 5));
    select exists(select 1 from public.reservas where reservas.codigo = codigo) into existe;
    exit when not existe;
  end loop;
  return codigo;
end;
$$;
