// 幂等台账：本地记录"哪些运单已经录过了"。
//
// 为什么用本地文件、而不是每次去查数据库？
//   1) 客户内网常常连不上公网数据库（FDE 现场常态），本地台账不依赖网络；
//   2) 录入动作发生在本地，本地留痕最快、最直接，不用多一次网络往返；
//   3) 台账本身就是审计材料——谁在什么时候录了哪一单、成功了还是失败了。
//
// 文件：automation/ledger.json（已 gitignore，不进仓库）
// 想换位置：在 .env.local 里设 LEDGER_PATH=xxx.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const LEDGER_PATH = process.env.LEDGER_PATH
  ? resolve(process.cwd(), process.env.LEDGER_PATH)
  : resolve(__dirname, "ledger.json");

export const FAILURES_PATH = resolve(dirname(LEDGER_PATH), "failures.json");

export type LedgerStatus = "entered" | "failed";

export interface LedgerEntry {
  tracking_no: string;
  status: LedgerStatus;
  at: string; // ISO 时间
  receiver?: string;
  amount?: string;
  source?: string; // 字段来自哪里（payload 文件 / api / cli）
  error?: string;
}

interface LedgerFile {
  version: 1;
  entries: LedgerEntry[];
}

function readLedger(): LedgerFile {
  if (!existsSync(LEDGER_PATH)) return { version: 1, entries: [] };
  try {
    const raw = JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as LedgerFile;
    if (!raw || !Array.isArray(raw.entries)) return { version: 1, entries: [] };
    return raw;
  } catch {
    // 台账坏了不能让整个录入流程瘫痪：先备份，再重建。
    // 这正是"本地文件也可能损坏"的兜底——直接崩掉会让人以为程序坏了。
    const backup = `${LEDGER_PATH}.broken-${Date.now()}`;
    try {
      writeFileSync(backup, readFileSync(LEDGER_PATH, "utf8"), "utf8");
    } catch {
      /* 备份失败也不阻塞 */
    }
    console.warn(`⚠️ 台账无法解析，已备份到 ${backup}，并重建空台账`);
    return { version: 1, entries: [] };
  }
}

function writeLedger(l: LedgerFile): void {
  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(l, null, 2), "utf8");
}

/**
 * 这个运单号以前成功录入过吗？
 * 倒序查找：同一条运单可能"先失败、后重试成功"，以最后一次成功记录为准。
 */
export function findEntered(trackingNo: string): LedgerEntry | undefined {
  const key = trackingNo.trim();
  if (!key) return undefined;
  const entries = readLedger().entries;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.tracking_no === key && e.status === "entered") return e;
  }
  return undefined;
}

/** 追加一条记录（成功或失败都记，失败记录是排查依据） */
export function appendEntry(entry: Omit<LedgerEntry, "at"> & { at?: string }): void {
  const l = readLedger();
  l.entries.push({ ...entry, at: entry.at ?? new Date().toISOString() });
  writeLedger(l);
}

// ---------------------------------------------------------------------------
// 失败清单：批处理跑完后，把本次失败的条目单独存一份，供"只重试失败项"使用。
// 和台账分开的原因：台账是长期审计流水，失败清单是"本次待办"，会被覆盖。
// ---------------------------------------------------------------------------
export interface FailedItem {
  tracking_no: string;
  fields: Record<string, string>;
  error: string;
  at: string;
}

export function readFailures(): FailedItem[] {
  if (!existsSync(FAILURES_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(FAILURES_PATH, "utf8"));
    return Array.isArray(raw) ? (raw as FailedItem[]) : [];
  } catch {
    return [];
  }
}

export function writeFailures(items: FailedItem[]): void {
  mkdirSync(dirname(FAILURES_PATH), { recursive: true });
  writeFileSync(FAILURES_PATH, JSON.stringify(items, null, 2), "utf8");
}
