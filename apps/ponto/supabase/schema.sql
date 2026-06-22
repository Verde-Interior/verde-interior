-- ============================================================
-- Verde Interior — Ponto HD | Schema SQL
-- Execute inteiro no Supabase SQL Editor (uma única vez)
-- ============================================================

-- COLABORADORES
create table if not exists employees (
  id            serial primary key,
  name          text    not null,
  cargo         text    not null,
  contract_type text    not null,
  daily_hours   int     not null default 8,
  bank_minutes  int     not null default 0,
  worked_hours  numeric not null default 0,
  extra_hours   numeric not null default 0,
  due_hours     numeric not null default 0,
  days_worked   int     not null default 0,
  created_at    timestamptz default now()
);

-- PERFIS (liga auth.users → employees)
create table if not exists profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  employee_id int  references employees(id) on delete set null,
  username    text not null unique,
  role        text not null default 'colab'
);

-- REGISTROS DE PONTO
create table if not exists punch_records (
  id          serial primary key,
  employee_id int  not null references employees(id) on delete cascade,
  date        date not null,
  type        text not null,
  time        text not null,
  obs         text,
  created_at  timestamptz default now()
);
create index if not exists punch_records_emp_date on punch_records(employee_id, date);

-- JUSTIFICATIVAS
create table if not exists justifications (
  id          serial primary key,
  employee_id int  not null references employees(id) on delete cascade,
  date        date not null,
  type        text not null,
  description text not null,
  status      text not null default 'pendente',
  created_at  timestamptz default now()
);

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────
alter table employees      enable row level security;
alter table profiles       enable row level security;
alter table punch_records  enable row level security;
alter table justifications enable row level security;

-- Funções auxiliares (security definer = rodam como owner, sem recursão no RLS)
create or replace function is_gestor()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'gestor');
$$;

create or replace function my_employee_id()
returns int language sql security definer stable as $$
  select employee_id from profiles where id = auth.uid();
$$;

-- EMPLOYEES
create policy "read employees"   on employees for select to authenticated using (true);
create policy "insert employees" on employees for insert to authenticated with check (is_gestor());
create policy "update employees" on employees for update to authenticated using (is_gestor());
create policy "delete employees" on employees for delete to authenticated using (is_gestor());

-- PROFILES
create policy "read profiles" on profiles for select to authenticated
  using (id = auth.uid() or is_gestor());

-- PUNCH RECORDS
create policy "read punch_records"   on punch_records for select to authenticated
  using (employee_id = my_employee_id() or is_gestor());
create policy "insert punch_records" on punch_records for insert to authenticated
  with check (employee_id = my_employee_id() or is_gestor());
create policy "update punch_records" on punch_records for update to authenticated
  using (employee_id = my_employee_id() or is_gestor());
create policy "delete punch_records" on punch_records for delete to authenticated
  using (employee_id = my_employee_id() or is_gestor());

-- JUSTIFICATIONS
create policy "read justifications"   on justifications for select to authenticated
  using (employee_id = my_employee_id() or is_gestor());
create policy "insert justifications" on justifications for insert to authenticated
  with check (employee_id = my_employee_id() or is_gestor());
create policy "update justifications" on justifications for update to authenticated
  using (is_gestor());
create policy "delete justifications" on justifications for delete to authenticated
  using (employee_id = my_employee_id() or is_gestor());
