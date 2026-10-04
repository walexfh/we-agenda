-- ==============================================================================
-- SCHEMA DO BANCO DE DADOS — W&E.AGENDA (ETAPA 2)
-- Compatível com Supabase PostgreSQL, Row Level Security (RLS) e Isolamento por Usuário
-- ==============================================================================

-- 1. TABELA DE PERFIS DE USUÁRIOS
-- Vinculada diretamente a auth.users(id) com exclusão em cascata
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. TABELA DE ITENS DA AGENDA E FINANÇAS
create table if not exists public.calendar_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date_str text not null, -- Data de calendário no formato YYYY-MM-DD
  type text not null check (type in ('appointment', 'income', 'expense')),
  title text not null,
  description text default '',
  start_time text,        -- HH:mm para compromissos
  end_time text,          -- HH:mm para compromissos
  color text default '#3b82f6',
  alert_minutes integer default 0,
  amount_cents bigint,    -- Centavos inteiros (R$ 33,50 = 3350)
  is_paid boolean default false,
  series_id uuid,         -- Chave estrangeira conceitual para séries recorrentes
  recurrence_id text,     -- Identificador legado para manter compatibilidade
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. TABELA DE SÉRIES RECORRENTES
create table if not exists public.recurrence_series (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  start_date text not null, -- YYYY-MM-DD
  end_date text,           -- YYYY-MM-DD (opcional)
  original_day_of_month integer, -- Para restaurar dia 31 em meses menores
  template_item jsonb not null default '{}'::jsonb,
  exceptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. TABELA DE FILA DE LEMBRETES E NOTIFICAÇÕES (ETAPA 3)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  channel text not null check (channel in ('browser_notification', 'web_push', 'whatsapp')),
  scheduled_at timestamptz not null,
  status text not null check (status in ('scheduled', 'sent', 'delivered', 'failed', 'dismissed')) default 'scheduled',
  title text not null,
  body text default '',
  advance_minutes integer default 0,
  timezone text not null default 'America/Sao_Paulo',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_reminders_user_item unique (user_id, item_id)
);

-- ==============================================================================
-- ÍNDICES PARA ALTA PERFORMANCE
-- ==============================================================================
create index if not exists idx_calendar_items_user_date on public.calendar_items(user_id, date_str);
create index if not exists idx_calendar_items_series on public.calendar_items(series_id);
create index if not exists idx_recurrence_series_user on public.recurrence_series(user_id);
create index if not exists idx_reminders_user_scheduled on public.reminders(user_id, scheduled_at, status);
create index if not exists idx_reminders_status_scheduled on public.reminders(status, scheduled_at);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) — ISOLAMENTO RIGOROSO ENTRE USUÁRIOS
-- Nunca confia no user_id enviado pelo cliente: valida contra auth.uid()
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.calendar_items enable row level security;
alter table public.recurrence_series enable row level security;
alter table public.reminders enable row level security;

-- Políticas para Profiles
create policy "Usuários podem visualizar apenas seu próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuários podem criar apenas seu próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Usuários podem atualizar apenas seu próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Políticas para Calendar Items
create policy "Usuários podem visualizar apenas seus próprios itens"
  on public.calendar_items for select
  using (auth.uid() = user_id);

create policy "Usuários podem inserir apenas itens com seu próprio user_id"
  on public.calendar_items for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar apenas seus próprios itens"
  on public.calendar_items for update
  using (auth.uid() = user_id);

create policy "Usuários podem excluir apenas seus próprios itens"
  on public.calendar_items for delete
  using (auth.uid() = user_id);

-- Políticas para Recurrence Series
create policy "Usuários podem visualizar apenas suas próprias séries"
  on public.recurrence_series for select
  using (auth.uid() = user_id);

create policy "Usuários podem inserir apenas séries com seu próprio user_id"
  on public.recurrence_series for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar apenas suas próprias séries"
  on public.recurrence_series for update
  using (auth.uid() = user_id);

create policy "Usuários podem excluir apenas suas próprias séries"
  on public.recurrence_series for delete
  using (auth.uid() = user_id);

-- Políticas para Reminders (Etapa 3)
create policy "Usuários podem visualizar apenas seus próprios lembretes"
  on public.reminders for select
  using (auth.uid() = user_id);

create policy "Usuários podem inserir apenas lembretes com seu próprio user_id"
  on public.reminders for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar apenas seus próprios lembretes"
  on public.reminders for update
  using (auth.uid() = user_id);

create policy "Usuários podem excluir apenas seus próprios lembretes"
  on public.reminders for delete
  using (auth.uid() = user_id);

-- ==============================================================================
-- TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- ==============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create or replace trigger set_calendar_items_updated_at
  before update on public.calendar_items
  for each row execute function public.handle_updated_at();

create or replace trigger set_recurrence_series_updated_at
  before update on public.recurrence_series
  for each row execute function public.handle_updated_at();

create or replace trigger set_reminders_updated_at
  before update on public.reminders
  for each row execute function public.handle_updated_at();

-- ==============================================================================
-- TRIGGER PARA CRIAÇÃO AUTOMÁTICA DO PERFIL APÓS REGISTRO EM AUTH.USERS
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
