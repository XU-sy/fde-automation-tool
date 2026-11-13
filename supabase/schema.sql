-- FDE 自动化工具：核心表
-- 在 Supabase 控制台的 SQL Editor 里执行本文件。

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  filename text,
  raw_text text,
  extracted jsonb,            -- 提取出的字段，如 {"tracking_no": "...", "receiver": "..."}
  status text default 'pending'  -- pending | extracted | entered
);

-- 行级安全（RLS）：先开一个最简策略，后续按你的账号体系收紧。
alter table documents enable row level security;

-- 注意：下面这条策略仅用于本地快速跑通，生产环境请改为基于 auth.uid() 的细粒度策略。
create policy "allow all (dev only)"
  on documents for all
  using (true)
  with check (true);
