"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

type Document = {
  id: string;
  created_at: string;
  filename: string | null;
  extracted: Record<string, string> | null;
  status: string;
};

export default function Home() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocs() {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("读取历史记录失败:", error);
      } else {
        setDocs((data as Document[]) ?? []);
      }
      setLoading(false);
    }

    fetchDocs();
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-3xl font-bold">FDE 工作流自动化工具</h1>
      <p className="text-slate-600 leading-relaxed">
        上传客户的 PDF（运单 / 订单），自动提取字段，校对后一键录入目标网页系统。
        本 MVP 用于把 <b>Next.js + Tailwind + shadcn + Supabase + Playwright/CDP + MCP</b>{" "}
        全链路串起来练习——正是"草莽 FDE"进现场、重写工作流的那套打法。
      </p>

      <Link href="/upload">
        <Button>开始录入</Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>历史记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500">加载中...</p>
          ) : docs.length === 0 ? (
            <p className="text-slate-500">暂无记录，去上传一个 PDF 试试。</p>
          ) : (
            <ul className="space-y-3">
              {docs.map((doc) => (
                <li key={doc.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{doc.filename || "未命名文件"}</span>
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">
                      {doc.status}
                    </span>
                  </div>
                  <pre className="text-xs bg-slate-100 p-2 rounded mt-2 overflow-auto">
                    {JSON.stringify(doc.extracted, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
