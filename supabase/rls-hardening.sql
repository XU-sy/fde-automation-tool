-- =====================================================================
-- documents 表 RLS 收紧（阶段一：不引入登录，先缩小破坏面）
-- 背景：线上已部署（https://fde-automation-tool.vercel.app），
--       anon key 会随网页发给任何访客，原先的 "allow all (dev only)"
--       等于：任何拿到链接的人都能读、改、删整张表。
-- 目标：保留现有功能（读历史 / 上传写入 / 保存校对），但**禁止删除**。
-- 执行：Supabase 控制台 → SQL Editor → 整段粘贴 → Run
-- =====================================================================

-- 1) 删掉那条全开的开发策略
drop policy if exists "allow all (dev only)" on documents;

-- 2) 逐项放行：只给应用真正用到的三个动作
--    读：首页历史列表（app/page.tsx 的 select）
drop policy if exists "anon can read" on documents;
create policy "anon can read"
  on documents for select
  using (true);

--    写：上传后写入一条（app/upload/page.tsx 的 insert）
drop policy if exists "anon can insert" on documents;
create policy "anon can insert"
  on documents for insert
  with check (true);

--    改：校对后保存（app/upload/page.tsx 的 update ... eq id）
drop policy if exists "anon can update" on documents;
create policy "anon can update"
  on documents for update
  using (true)
  with check (true);

-- 3) 关键：**故意不创建 delete 策略**
--    RLS 的规则是"没有策略 = 默认拒绝"。
--    所以上面三步做完，匿名访客可以读写，但调用 delete 会被拒。
--    这挡住的正是最致命的一种破坏：别人把你整张表清空。


-- =====================================================================
-- 阶段二（等要发给真实客户前再做，现在别执行）
-- 需要先给项目加登录：Supabase Auth（邮箱验证码 / 匿名登录），
-- 然后改成"每个人只能看到自己的单据"：
--
--   alter table documents add column if not exists user_id uuid default auth.uid();
--   drop policy if exists "anon can read"   on documents;
--   drop policy if exists "anon can insert" on documents;
--   drop policy if exists "anon can update" on documents;
--   create policy "own rows" on documents for all
--     using (auth.uid() = user_id)
--     with check (auth.uid() = user_id);
--
-- 注意：一旦启用 auth.uid()，未登录的访客读不到任何数据，
--       现有页面会在"没有登录"的情况下显示空列表 —— 必须与登录功能同批上线。
-- =====================================================================
