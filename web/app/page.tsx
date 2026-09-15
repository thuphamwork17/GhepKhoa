import { redirect } from "next/navigation";
import { nguoiDangNhap } from "@/lib/auth";

// Hệ thống chỉ dùng nội bộ — không còn cổng đăng ký công khai. "/" chỉ còn
// tác dụng đưa người vào đúng chỗ: đã đăng nhập thì vào thẳng /admin, chưa
// thì ra màn đăng nhập.
export const dynamic = "force-dynamic";

export default async function Trang() {
  const nd = await nguoiDangNhap().catch(() => null);
  redirect(nd ? "/admin" : "/dang-nhap");
}
