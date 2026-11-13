// Step 6：可编辑的"结果校对表格"。
// FDE 现场的真实需求：机器抽出来的字段不能直接用，必须让人复核一遍再进系统。
// 所以这里做成可编辑表格 + 高亮未识别项，而不是只读 JSON。

"use client";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** 字段 key -> 中文标签 */
export const FIELD_LABELS: Record<string, string> = {
  tracking_no: "运单号",
  receiver: "收件人",
  phone: "联系电话",
  address: "收货地址",
  date: "下单日期",
  amount: "金额",
};

type Props = {
  fields: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
};

export function FieldReviewTable({ fields, onChange }: Props) {
  const keys = Object.keys(fields).filter((k) => !k.startsWith("_"));

  if (keys.length === 0) {
    return (
      <p className="text-sm text-amber-600">
        未能识别到结构化字段，可切换下方"手动补录"或改用 OCR / 大模型兜底。
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">字段</TableHead>
          <TableHead>提取值（可编辑校对）</TableHead>
          <TableHead className="w-20 text-center">状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((k) => {
          const value = fields[k] ?? "";
          const empty = value.trim() === "";
          return (
            <TableRow key={k}>
              <TableCell className="font-medium text-slate-700">
                {FIELD_LABELS[k] ?? k}
              </TableCell>
              <TableCell>
                <Input
                  value={value}
                  onChange={(e) =>
                    onChange({ ...fields, [k]: e.target.value })
                  }
                  className={cn(empty && "border-amber-400 bg-amber-50")}
                  placeholder="未识别，请手动填写"
                />
              </TableCell>
              <TableCell className="text-center">
                {empty ? (
                  <span className="text-xs text-amber-600">待补</span>
                ) : (
                  <span className="text-xs text-green-600">已识别</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
