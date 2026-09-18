import Link from "next/link";
import { redirect } from "next/navigation";

import { nguoiDangNhap } from "@/lib/auth";
import { dangXuat } from "../actions";
import { DaiMau, Logo } from "../ThanhTieuDe";

export const dynamic = "force-dynamic";

const MUC = [
  { href: "/admin", chu: "Danh sách đăng ký" },
  { href: "/admin/dot", chu: "Lịch thi" },
  { href: "/admin/ho-so", chu: "Hồ sơ dự thi" },
  { href: "/admin/log", chu: "Nhật ký" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nd = await nguoiDangNhap().catch(() => null);
  if (!nd) redirect("/dang-nhap");

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col sm:flex-row sm:items-center gap-x-4 gap-y-3 px-4 py-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            {/* Logo và tên */}
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-md px-1 py-0.5 transition hover:opacity-80"
            >
              <Logo co={42} />
              <span className="text-[15px] font-bold leading-tight text-[#0b5590]">
                Quản trị ghép khóa
              </span>
            </Link>
            
            <form action={dangXuat} className="sm:hidden">
              <button className="rounded-md border border-[#c8d2e0] px-3 py-1.5 text-[13px] text-[#4a5666] transition hover:border-[#e0aaa3] hover:bg-[#fdf3f2] hover:text-[#8f2a1d]">
                Đăng xuất
              </button>
            </form>
          </div>

          <nav className="flex w-full sm:w-auto overflow-x-auto gap-1 text-[14px] sm:ml-4 pb-1 sm:pb-0 scrollbar-hide">
            {MUC.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-[#4a5666] transition hover:bg-[#eaf2f9] hover:text-[#0b5590]"
              >
                {m.chu}
              </Link>
            ))}
          </nav>

          <form action={dangXuat} className="ml-auto hidden sm:block">
            <button className="rounded-md border border-[#c8d2e0] px-3 py-1.5 text-[13px] text-[#4a5666] transition hover:border-[#e0aaa3] hover:bg-[#fdf3f2] hover:text-[#8f2a1d]">
              Đăng xuất
            </button>
          </form>
        </div>
        <DaiMau />
      </header>
      {children}
    </div>
  );
}
