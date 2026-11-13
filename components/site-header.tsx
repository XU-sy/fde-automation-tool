import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-5xl flex items-center justify-between p-4">
        <Link href="/" className="font-bold">
          FDE 自动化
        </Link>
        <Link href="/upload" className="text-sm text-blue-600 hover:underline">
          录入
        </Link>
      </div>
    </header>
  );
}
