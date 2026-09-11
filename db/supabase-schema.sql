-- TELAS JORT — estrutura completa do banco para Supabase/PostgreSQL
-- Execute este arquivo inteiro em: Supabase Dashboard > SQL Editor > New query
-- O script e seguro para uma primeira execucao e nao apaga tabelas nem dados existentes.

begin;

create extension if not exists pgcrypto;

create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_accounts_email_unique_idx
  on public.customer_accounts (lower(email));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_number text not null unique,
  status text not null default 'pending',
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'unfulfilled',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  coupon_code text,
  total_cents integer not null check (total_cents >= 0),
  customer_encrypted text not null,
  shipping_service text not null,
  shipping_quote_id text,
  payment_provider_id text,
  payment_provider text,
  customer_account_id uuid references public.customer_accounts(id) on delete set null,
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_discount_not_above_subtotal check (discount_cents <= subtotal_cents),
  constraint orders_refund_not_above_total check (refunded_cents <= total_cents)
);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);
create index if not exists orders_customer_account_idx
  on public.orders (customer_account_id, created_at desc);
create index if not exists orders_payment_provider_id_idx
  on public.orders (payment_provider, payment_provider_id)
  where payment_provider_id is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  sku text not null,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  weight_kg double precision not null check (weight_kg >= 0),
  measurement_json jsonb
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

create table if not exists public.visitor_sessions (
  visitor_id text primary key,
  ip_hash text not null,
  path text not null,
  device text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists visitor_sessions_last_seen_idx
  on public.visitor_sessions (last_seen_at desc);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  event text not null,
  path text not null,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx
  on public.analytics_events (created_at desc);
create index if not exists analytics_events_visitor_idx
  on public.analytics_events (visitor_id, created_at desc);

create table if not exists public.webhook_events (
  provider text not null,
  provider_event_id text not null,
  status text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, provider_event_id)
);

create index if not exists webhook_events_status_idx
  on public.webhook_events (status, received_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);

create table if not exists public.product_configs (
  product_id text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_configs (
  provider text primary key,
  enabled boolean not null default false,
  environment text not null default 'sandbox',
  public_config_json jsonb not null default '{}'::jsonb,
  secret_config_encrypted text,
  last_test_status text,
  last_test_message text,
  last_tested_at timestamptz,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  constraint integration_environment_valid check (environment in ('sandbox', 'production')),
  constraint integration_test_status_valid check (last_test_status is null or last_test_status in ('success', 'failed'))
);

create table if not exists public.coupons (
  code text primary key,
  kind text not null check (kind in ('percentage', 'fixed')),
  value integer not null check (value > 0),
  minimum_cents integer not null default 0 check (minimum_cents >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coupons_active_idx
  on public.coupons (active, expires_at);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_amount_cents integer not null check (requested_amount_cents > 0),
  reason text not null,
  status text not null default 'requested',
  provider text,
  provider_refund_id text,
  requested_by text not null,
  reviewed_by text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_request_status_valid check (status in ('requested', 'processing', 'completed', 'failed', 'rejected'))
);

create index if not exists refund_requests_order_idx
  on public.refund_requests (order_id, created_at desc);
create index if not exists refund_requests_status_idx
  on public.refund_requests (status, created_at desc);

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null,
  provider_reference text not null unique,
  status text not null default 'queued',
  access_key text,
  number text,
  series text,
  danfe_url text,
  xml_url text,
  error_message text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_document_status_valid check (status in ('queued', 'processing', 'authorized', 'error', 'cancelled'))
);

create index if not exists fiscal_documents_status_idx
  on public.fiscal_documents (status, updated_at desc);

-- Mantem updated_at correto mesmo quando uma atualizacao nao enviar esse campo.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_accounts_set_updated_at on public.customer_accounts;
create trigger customer_accounts_set_updated_at before update on public.customer_accounts
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists product_configs_set_updated_at on public.product_configs;
create trigger product_configs_set_updated_at before update on public.product_configs
for each row execute function public.set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();

drop trigger if exists integration_configs_set_updated_at on public.integration_configs;
create trigger integration_configs_set_updated_at before update on public.integration_configs
for each row execute function public.set_updated_at();

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at before update on public.coupons
for each row execute function public.set_updated_at();

drop trigger if exists refund_requests_set_updated_at on public.refund_requests;
create trigger refund_requests_set_updated_at before update on public.refund_requests
for each row execute function public.set_updated_at();

drop trigger if exists fiscal_documents_set_updated_at on public.fiscal_documents;
create trigger fiscal_documents_set_updated_at before update on public.fiscal_documents
for each row execute function public.set_updated_at();

-- O ecommerce acessa estes dados somente pelo servidor. Sem politicas, anon e
-- authenticated nao conseguem ler ou alterar registros diretamente pela API.
alter table public.customer_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.product_configs enable row level security;
alter table public.store_settings enable row level security;
alter table public.integration_configs enable row level security;
alter table public.coupons enable row level security;
alter table public.refund_requests enable row level security;
alter table public.fiscal_documents enable row level security;

revoke all on table
  public.customer_accounts,
  public.orders,
  public.order_items,
  public.visitor_sessions,
  public.analytics_events,
  public.webhook_events,
  public.audit_logs,
  public.product_configs,
  public.store_settings,
  public.integration_configs,
  public.coupons,
  public.refund_requests,
  public.fiscal_documents
from anon, authenticated;

grant all on table
  public.customer_accounts,
  public.orders,
  public.order_items,
  public.visitor_sessions,
  public.analytics_events,
  public.webhook_events,
  public.audit_logs,
  public.product_configs,
  public.store_settings,
  public.integration_configs,
  public.coupons,
  public.refund_requests,
  public.fiscal_documents
to service_role;

comment on table public.customer_accounts is 'Contas dos compradores da loja.';
comment on table public.orders is 'Pedidos e estado de pagamento, separacao, entrega e estorno.';
comment on table public.integration_configs is 'Configuracoes publicas e segredos cifrados das integracoes.';
comment on table public.fiscal_documents is 'Estado da emissao fiscal e links da NF-e associados a cada pedido.';
comment on column public.customer_accounts.password_hash is 'Hash scrypt; nunca armazena a senha original.';
comment on column public.orders.customer_encrypted is 'Dados pessoais do comprador cifrados pela aplicacao.';
comment on column public.integration_configs.secret_config_encrypted is 'Credenciais cifradas pela aplicacao.';

commit;

-- Depois de executar, confira em Table Editor se as 13 tabelas foram criadas.
-- Nao ative a troca do banco na aplicacao antes de importar e validar os dados.
