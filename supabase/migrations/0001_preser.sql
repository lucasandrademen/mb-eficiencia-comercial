-- PRESER (Prêmio de Serviço e Resultado) — Remuneração Broker Nestlé
-- 5 tabelas: cabeçalho + 4 detalhamentos por critério

create table if not exists preser_extrato (
  id uuid primary key default gen_random_uuid(),
  periodo date not null unique,
  broker text default '35 BROK MB',
  planta text default '2858',
  regional text default 'NE',
  valor_total_comissao numeric(12,2),
  valor_total_contabilizado numeric(12,2),
  faturamento_ac numeric(14,2),
  pct_remuneracao_sobre_fat numeric(8,6) generated always as
    (valor_total_comissao / nullif(faturamento_ac, 0)) stored,
  irrf_retido numeric(12,2),
  pis_retido numeric(12,2),
  cofins_retido numeric(12,2),
  csll_retido numeric(12,2),
  created_at timestamptz default now()
);

create table if not exists preser_sku (
  id uuid primary key default gen_random_uuid(),
  extrato_id uuid references preser_extrato(id) on delete cascade,
  grupo_codigo int not null,
  grupo_nome text not null,
  divisao text,
  categoria int not null,
  categoria_nome text,
  efetivo numeric(14,3),
  efetivo_adicional numeric(14,3),
  efetivo_total numeric(14,3),
  pct_comissao numeric(8,6),
  comissao numeric(12,3)
);
create index if not exists idx_preser_sku_extrato on preser_sku(extrato_id);
create index if not exists idx_preser_sku_categoria on preser_sku(categoria);
create index if not exists idx_preser_sku_divisao on preser_sku(divisao);

create table if not exists preser_drops (
  id uuid primary key default gen_random_uuid(),
  extrato_id uuid references preser_extrato(id) on delete cascade,
  canal_codigo int not null,
  canal_nome text not null,
  qtd_drops int,
  rs_por_drop numeric(10,3),
  fator_regionalizacao numeric(8,6),
  fator_deslocamento numeric(8,6),
  rs_calculado numeric(10,3),
  comissao numeric(12,3)
);
create index if not exists idx_preser_drops_extrato on preser_drops(extrato_id);

create table if not exists preser_metas (
  id uuid primary key default gen_random_uuid(),
  extrato_id uuid references preser_extrato(id) on delete cascade,
  criterio_codigo int,
  criterio_nome text,
  bu text,
  tipo text check (tipo in ('VBC', 'Cobertura', 'Recomendador')),
  objetivo_minimo numeric(14,3),
  objetivo_meta numeric(14,3),
  objetivo_ideal numeric(14,3),
  pct_minimo numeric(8,6) default 0.0035,
  pct_meta numeric(8,6) default 0.005,
  pct_ideal numeric(8,6) default 0.0065,
  efetivo_fiscal numeric(14,3),
  efetivo_mes numeric(14,3),
  pct_atingido numeric(8,6),
  comissao numeric(12,3),
  pct_realizacao numeric(8,6) generated always as
    (efetivo_fiscal / nullif(objetivo_meta, 0)) stored
);
create index if not exists idx_preser_metas_extrato on preser_metas(extrato_id);
create index if not exists idx_preser_metas_tipo on preser_metas(tipo);
create index if not exists idx_preser_metas_bu on preser_metas(bu);

create table if not exists preser_outros (
  id uuid primary key default gen_random_uuid(),
  extrato_id uuid references preser_extrato(id) on delete cascade,
  criterio_codigo int,
  criterio_nome text,
  tipo_servico text,
  bu text,
  base_calculo numeric(14,3),
  base_unidade text,
  rs_unitario numeric(10,3),
  comissao numeric(12,3),
  observacao text,
  contabilizado boolean default true
);
create index if not exists idx_preser_outros_extrato on preser_outros(extrato_id);

-- RLS: por enquanto permissivo (ajustar quando autenticação for adicionada)
alter table preser_extrato enable row level security;
alter table preser_sku enable row level security;
alter table preser_drops enable row level security;
alter table preser_metas enable row level security;
alter table preser_outros enable row level security;

create policy "preser_extrato_all" on preser_extrato for all using (true) with check (true);
create policy "preser_sku_all" on preser_sku for all using (true) with check (true);
create policy "preser_drops_all" on preser_drops for all using (true) with check (true);
create policy "preser_metas_all" on preser_metas for all using (true) with check (true);
create policy "preser_outros_all" on preser_outros for all using (true) with check (true);
