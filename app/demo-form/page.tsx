"use client";

// Step 7 的练习场：模拟"客户的网页系统"。
// 真实场景里客户的老系统只有网页表单、没有 API，员工每天人肉录入。
// 我们用 CDP/Playwright 自动填这张表 —— 练的就是这个。
// 选择器约定（刻意用稳定 id，方便练习 DevTools 查找）：
//   #f-tracking-no  #f-receiver  #f-phone  #f-address  #f-date  #f-amount  #f-submit

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DemoFormPage() {
  const [submitted, setSubmitted] = useState<Record<string, string> | null>(
    null
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const record: Record<string, string> = {};
    data.forEach((v, k) => (record[k] = String(v)));
    console.log("[demo-form] 收到录入提交:", record);
    setSubmitted(record);
  }

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-2xl font-bold">客户订单录入系统（模拟）</h1>
      <p className="text-sm text-slate-500">
        这是 Step 7 的练习目标页：假装它是客户那个"只有网页、没有 API"的老系统。
        自动化脚本会把提取好的字段填进下面的输入框并提交。
      </p>

      {submitted && (
        <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-700">
          ✅ 录入成功（模拟）。收到的数据：{JSON.stringify(submitted)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>新建订单</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="f-tracking-no" className="text-sm font-medium">
                运单号
              </label>
              <Input id="f-tracking-no" name="tracking_no" placeholder="如 SF1234567890" />
            </div>

            <div className="space-y-1">
              <label htmlFor="f-receiver" className="text-sm font-medium">
                收件人
              </label>
              <Input id="f-receiver" name="receiver" placeholder="收件人姓名" />
            </div>

            <div className="space-y-1">
              <label htmlFor="f-phone" className="text-sm font-medium">
                联系电话
              </label>
              <Input id="f-phone" name="phone" placeholder="手机号" />
            </div>

            <div className="space-y-1">
              <label htmlFor="f-address" className="text-sm font-medium">
                收货地址
              </label>
              <Input id="f-address" name="address" placeholder="详细地址" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="f-date" className="text-sm font-medium">
                  下单日期
                </label>
                <Input id="f-date" name="date" placeholder="2026-01-01" />
              </div>
              <div className="space-y-1">
                <label htmlFor="f-amount" className="text-sm font-medium">
                  金额
                </label>
                <Input id="f-amount" name="amount" placeholder="0.00" />
              </div>
            </div>

            <Button id="f-submit" type="submit">
              提交订单
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
