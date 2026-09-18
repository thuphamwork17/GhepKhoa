import { redirect } from "next/navigation";

import { nguoiDangNhap, phamViDonVi } from "@/lib/auth";
import { dsNhatKy } from "@/lib/db";

export const dynamic = "force-dynamic";

const NHAN_HANH_DONG: Record<string, string> = {
  DANG_NHAP: "Đăng nhập",
  DANG_XUAT: "Đăng xuất",
  TAO_DOT: "Tạo đợt",
  SUA_DOT: "Sửa đợt",
  XOA_DOT: "Xóa đợt",
  THEM_DANG_KY: "Thêm đăng ký",
  DOI_CHIEU_LAI: "Đối chiếu lại",
  DOI_TRANG_THAI: "Đổi trạng thái",
  XOA: "Xóa đăng ký",
  XUAT_FILE: "Xuất file ghép khóa",
  CAP_NHAT_HO_SO: "Cập nhật hồ sơ",
  NAP_HO_SO_HANG_LOAT: "Nạp hồ sơ hàng loạt",
};

const MAU_HANH_DONG: Record<string, string> = {
  XOA: "bg-[#fdf3f2] text-[#8f2a1d]",
  XOA_DOT: "bg-[#fdf3f2] text-[#8f2a1d]",
  DANG_NHAP: "bg-[#eaf2f9] text-[#0b5590]",
  DANG_XUAT: "bg-[#f2f4f7] text-[#5c6878]",
  XUAT_FILE: "bg-[#f1f8f2] text-[#215c2c]",
};

/** NoiDung có thể là "tóm tắt\n---\nAPI: ...\n{json}" (xem ghiNhatKy trong
 *  actions.ts) — tách phần chi tiết API ra để hiện thu gọn riêng. */
function tachChiTiet(noiDung: string | null): { tomTat: string; chiTiet: string | null } {
  const s = noiDung ?? "";
  const i = s.indexOf("\n---\n");
  return i < 0 ? { tomTat: s, chiTiet: null } : { tomTat: s.slice(0, i), chiTiet: s.slice(i + 5) };
}

function gioVN(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function Trang() {
  const nd = await nguoiDangNhap();
  if (!nd) redirect("/dang-nhap");
  const pv = phamViDonVi(nd);

  const ds = await dsNhatKy({ donViId: pv, gioiHan: 300 });
  const soLoi = ds.filter((n) => n.NoiDung?.startsWith("LỖI:")).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="border-b border-[#dfe4ec] pb-5">
        <h1 className="text-[20px] font-bold text-[#0b5590]">Nhật ký</h1>
        <p className="mt-1 text-[14px] text-[#5c6878]">
          Ai làm gì lúc nào trên trang quản trị — {ds.length} dòng gần nhất
          {soLoi > 0 && (
            <span className="font-semibold text-[#8f2a1d]"> ({soLoi} lỗi)</span>
          )}
          .{pv === undefined
            ? " Đang xem cả hai đơn vị."
            : ` Chỉ hiển thị thao tác của người thuộc ${nd.TenVietTat}.`}
        </p>
      </div>

      <section className="the mt-5 overflow-x-auto">
        <table className="w-full min-w-[800px] text-[14px]">
          <thead>
            <tr className="border-b border-[#dfe4ec] bg-[#f7f9fc] text-left text-[12px] uppercase tracking-wide text-[#5c6878]">
              <th className="px-3 py-3 font-semibold">Thời điểm</th>
              <th className="px-3 py-3 font-semibold">Người dùng</th>
              <th className="px-3 py-3 font-semibold">Hành động</th>
              <th className="px-3 py-3 font-semibold">Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {ds.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-[#7a8494]">
                  Chưa có nhật ký nào.
                </td>
              </tr>
            )}
            {ds.map((n) => {
              const laLoi = n.NoiDung?.startsWith("LỖI:") ?? false;
              const { tomTat, chiTiet } = tachChiTiet(n.NoiDung);
              const tomTatHien = laLoi ? tomTat.slice(5).trim() : tomTat;
              return (
                <tr
                  key={n.NhatKyId}
                  className={`border-b border-[#eef1f5] align-top last:border-0 hover:bg-[#fafbfd] ${laLoi ? "bg-[#fdf3f2]" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#5c6878]">
                    {gioVN(n.ThoiDiem)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="font-medium text-[#17202e]">{n.NguoiDung ?? "—"}</span>
                    {n.TenVietTat && (
                      <span className="ml-1.5 text-[12px] text-[#9aa4b4]">{n.TenVietTat}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[12px] font-medium ${
                        laLoi ? "bg-[#f6c9c2] text-[#8f2a1d]" : (MAU_HANH_DONG[n.HanhDong] ?? "bg-[#eef1f5] text-[#4a5666]")
                      }`}
                    >
                      {laLoi && "⚠ "}
                      {NHAN_HANH_DONG[n.HanhDong] ?? n.HanhDong}
                    </span>
                  </td>
                  <td className={`px-3 py-3 ${laLoi ? "font-medium text-[#8f2a1d]" : "text-[#334155]"}`}>
                    {tomTatHien}
                    {chiTiet && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-[#7a8494] hover:text-[#0b5590]">
                          Chi tiết API
                        </summary>
                        <pre className="mt-1 max-w-[520px] overflow-x-auto whitespace-pre-wrap break-all rounded bg-[#f7f9fc] p-2 text-[11px] leading-snug text-[#4a5666]">
                          {chiTiet}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
