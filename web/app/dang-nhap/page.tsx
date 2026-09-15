import Link from "next/link";
import { redirect } from "next/navigation";
import { coNguoiDungNao, nguoiDangNhap } from "@/lib/auth";
import FormDangNhap from "./FormDangNhap";
import { ThanhTieuDe } from "../ThanhTieuDe";

export const dynamic = "force-dynamic";

function Hop({ tieuDe, children }: { tieuDe: string; children: React.ReactNode }) {
  return (
    <>
      <ThanhTieuDe />
      <main className="mx-auto w-full max-w-2xl px-4 py-14">
        <div className="rounded-lg border border-[#e0aaa3] bg-[#fdf3f2] p-6 text-[#8f2a1d]">
          <h1 className="font-bold">{tieuDe}</h1>
          {children}
        </div>
      </main>
    </>
  );
}

export default async function Trang() {
  if (await nguoiDangNhap().catch(() => null)) redirect("/admin");

  let coTaiKhoan = false;
  try {
    coTaiKhoan = await coNguoiDungNao();
  } catch (e) {
    console.error("dang-nhap", e);
    return (
      <Hop tieuDe="Chưa kết nối được cơ sở dữ liệu">
        <p className="mt-2 text-[14px] leading-relaxed">
          Kiểm tra SQL Server đã chạy chưa và <code className="rounded bg-white px-1.5">web/.env.local</code>{" "}
          đã có đủ <code className="rounded bg-white px-1.5">SQL_MAY_CHU</code>,{" "}
          <code className="rounded bg-white px-1.5">SQL_NGUOI_DUNG</code>,{" "}
          <code className="rounded bg-white px-1.5">SQL_MAT_KHAU</code> chưa.
        </p>
        <p className="mt-2 text-[14px]">
          Chưa bật kết nối bao giờ thì chạy{" "}
          <code className="rounded bg-white px-1.5">sql\thiet_lap_ket_noi.ps1</code> bằng quyền
          Administrator.
        </p>
      </Hop>
    );
  }

  if (!coTaiKhoan) {
    return (
      <Hop tieuDe="Chưa có tài khoản cán bộ nào">
        <p className="mt-2 text-[14px] leading-relaxed">Tạo tài khoản quản trị đầu tiên:</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-[#17202e] p-3 text-[12px] text-white">
{`cd D:\\GhepKhoa\\web
node scripts/tao-nguoi-dung.mjs admin "Nguyễn Văn A" QUAN_TRI`}
        </pre>
      </Hop>
    );
  }

  return (
    <>
      <ThanhTieuDe />
      <main className="mx-auto w-full max-w-sm px-4 py-16">
        <h1 className="text-center text-[18px] font-bold text-[#0b5590]">Đăng nhập quản trị</h1>
        <p className="mt-1.5 text-center text-[13px] text-[#7a8494]">
          Khu vực dành riêng cho cán bộ
        </p>
        <div className="the mt-6 p-6 shadow-[0_1px_3px_rgba(11,85,144,0.08)]">
          <FormDangNhap />
        </div>
        <p className="mt-5 text-center text-[13px]">
          <Link href="/" className="text-[#0b5590] underline underline-offset-4">
            ← Về trang đăng ký
          </Link>
        </p>
      </main>
    </>
  );
}
