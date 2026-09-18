import Link from "next/link";
import { redirect } from "next/navigation";

import { nguoiDangNhap, phamViDonVi } from "@/lib/auth";
import { dsDangKy, dsDot } from "@/lib/db";
import { ngayISO, ngayVN } from "@/lib/kiemtra";
import { xoaDangKy } from "../actions";
import DoiChieuLai from "./DoiChieuLai";
import NhapNhanh from "./NhapNhanh";
import TraLai from "./TraLai";
import XuatFile from "./XuatFile";
import TimKiem from "./TimKiem";

export const dynamic = "force-dynamic";

const SO_DONG_MOI_TRANG = 20;

const CACH_KHOP: Record<string, { chu: string; lop: string }> = {
  CCCD: { chu: "khớp CCCD", lop: "bg-[#f1f8f2] text-[#215c2c]" },
  TEN_NGAYSINH: {
    chu: "khớp mờ: tên + ngày sinh",
    lop: "bg-[#fdf8ec] text-[#7a5a12]",
  },
  THU_CONG: { chu: "gán tay", lop: "bg-[#eaf2f9] text-[#0b5590]" },
};

export default async function Trang({
  searchParams,
}: {
  searchParams: Promise<{ dot?: string; trang?: string; q?: string }>;
}) {
  const nd = await nguoiDangNhap();
  if (!nd) redirect("/dang-nhap");
  const pv = phamViDonVi(nd);

  const sp = await searchParams;
  const dotId = Number(sp.dot) || undefined;
  const dots = await dsDot({ donViId: pv });
  // cán bộ đơn vị này không được xem đợt của đơn vị kia dù có sửa URL
  const dotHopLe =
    dotId && dots.some((d) => d.DotId === dotId) ? dotId : undefined;
  let ds = await dsDangKy({ dotId: dotHopLe, donViId: pv });

  const qStr = sp.q?.trim().toLowerCase() || "";
  if (qStr) {
    const qKhongDau = qStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    ds = ds.filter((d) => {
      const gop = [
        d.HoTenKhai,
        d.CccdKhai,
        d.MaKhoaGocKhai,
        d.GiaoVien,
        d.MaHocVien,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const gopKhongDau = gop.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
      return gop.includes(qStr) || gopKhongDau.includes(qKhongDau);
    });
  }

  const dem = {
    cho: ds.filter((d) => d.TrangThai === "CHO_DUYET").length,
    duyet: ds.filter((d) => d.TrangThai === "DUYET").length,
    tuChoi: ds.filter((d) => d.TrangThai === "TU_CHOI").length,
    chuaKhop: ds.filter((d) => !d.HocVienKhoaId).length,
  };
  const qs = new URLSearchParams();
  if (dotHopLe) qs.set("dot", String(dotHopLe));
  if (qStr) qs.set("q", qStr);
  const chuoi = qs.toString();
  const baseQ = chuoi ? `?${chuoi}&` : "?";
  
  // Đợt đã qua ngày thi thì không cần hiện trong ô chọn của Nhập nhanh nữa —
  // vẫn giữ trong thanh lọc đợt bên dưới để còn xem lại danh sách cũ.
  const homNay = ngayISO(new Date());
  const dotsChuaQua = dots.filter((d) => ngayISO(d.NgayThi) >= homNay);

  const tongTrang = Math.max(1, Math.ceil(ds.length / SO_DONG_MOI_TRANG));
  const trang = Math.min(Math.max(1, Number(sp.trang) || 1), tongTrang);
  const dsTrang = ds.slice((trang - 1) * SO_DONG_MOI_TRANG, trang * SO_DONG_MOI_TRANG);
  const duongDanTrang = (t: number) => {
    const p = new URLSearchParams();
    if (dotHopLe) p.set("dot", String(dotHopLe));
    if (qStr) p.set("q", qStr);
    if (t > 1) p.set("trang", String(t));
    const qsTrang = p.toString();
    return `/admin${qsTrang ? "?" + qsTrang : ""}`;
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#dfe4ec] pb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0b5590]">Ghép khóa</h1>
          <p className="mt-1 text-[14px] text-[#5c6878]">
            Nhập trực tiếp bên dưới — hệ thống tự đối chiếu với hồ sơ khóa cũ ngay khi thêm.
            {pv === undefined ? " Đang xem cả hai đơn vị." : ` Chỉ hiển thị đăng ký thuộc ${nd.TenVietTat}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <TimKiem />
          <a
            href={`/api/xuat${baseQ}dinhDang=csv`}
            className="rounded-lg border border-[#c8d2e0] px-3.5 py-2 text-[14px] font-medium text-[#0b5590] transition hover:bg-[#eaf2f9]"
          >
            Tải CSV
          </a>
          <a
            href={`/api/xuat${baseQ}dinhDang=xlsx`}
            className="rounded-lg border border-[#c8d2e0] px-3.5 py-2 text-[14px] font-medium text-[#0b5590] transition hover:bg-[#eaf2f9]"
          >
            Tải Excel
          </a>
          {dotHopLe && <XuatFile dotId={dotHopLe} />}
        </div>
      </div>

      <div className="mt-5">
        <NhapNhanh
          key={dotHopLe ?? "tat-ca"}
          dots={dotsChuaQua.map((d) => ({
            DotId: d.DotId,
            MaKhoaDich: d.MaKhoaDich,
            TenVietTat: d.TenVietTat,
            NgayThi: ngayISO(d.NgayThi),
          }))}
          dotMacDinh={dotsChuaQua.some((d) => d.DotId === dotHopLe) ? dotHopLe : undefined}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Tổng đăng ký", ds.length, "text-[#0b5590]"],
          ["Chờ đối chiếu", dem.cho, "text-[#7a5a12]"],
          ["Đã duyệt", dem.duyet, "text-[#215c2c]"],
          ["Chưa khớp hồ sơ", dem.chuaKhop, "text-[#8f2a1d]"],
        ].map(([nhan, so, mau]) => (
          <div key={String(nhan)} className="the px-4 py-3">
            <p className="text-[12px] uppercase tracking-wide text-[#7a8494]">
              {nhan}
            </p>
            <p className={`mt-0.5 text-[24px] font-bold tabular-nums ${mau}`}>
              {so}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        {/* Các đợt đang mở */}
        <div className="flex flex-wrap gap-2 text-[13px]">
          <Link
            href="/admin"
            className={`rounded-full border px-3.5 py-1.5 transition flex items-center ${
              !dotHopLe
                ? "border-[#0b5590] bg-[#0b5590] font-medium text-white shadow-sm"
                : "border-[#c8d2e0] text-[#17202e] bg-white hover:bg-[#eaf2f9] shadow-sm font-medium"
            }`}
          >
            Tất cả đợt
          </Link>
          {dots.filter(d => ngayISO(d.NgayThi) >= homNay || dotHopLe === d.DotId).map((d) => {
            const isSelected = dotHopLe === d.DotId;
            return (
              <Link
                key={d.DotId}
                href={`/admin?dot=${d.DotId}`}
                className={`rounded-full border px-3.5 py-1.5 transition flex items-center ${
                  isSelected 
                    ? "border-[#0b5590] bg-[#0b5590] font-medium text-white shadow-sm" 
                    : "border-[#c8d2e0] text-[#17202e] bg-white hover:bg-[#eaf2f9] shadow-sm font-medium"
                }`}
                title="Đợt đang mở"
              >
                {pv === undefined && (
                  <span className="mr-1 opacity-70 text-[11px]">{d.TenVietTat}</span>
                )}
                {d.MaKhoaDich} · {ngayVN(d.NgayThi)} ({d.SoDangKy})
              </Link>
            );
          })}
        </div>

        {/* Các đợt đã qua (Gom gọn) */}
        {dots.some(d => ngayISO(d.NgayThi) < homNay && dotHopLe !== d.DotId) && (
          <details className="group mt-3">
            <summary className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 cursor-pointer list-none select-none transition-all outline-hidden [&::-webkit-details-marker]:hidden">
              <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              Xem {dots.filter(d => ngayISO(d.NgayThi) < homNay && dotHopLe !== d.DotId).length} đợt đã thi
            </summary>
            
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-inner">
              <div className="flex flex-wrap gap-2 text-[13px]">
                {dots.filter(d => ngayISO(d.NgayThi) < homNay && dotHopLe !== d.DotId).map((d) => (
                  <Link
                    key={d.DotId}
                    href={`/admin?dot=${d.DotId}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-500 shadow-sm transition hover:border-[#0b5590] hover:text-[#0b5590] hover:shadow-md"
                    title="Đợt đã thi"
                  >
                    {pv === undefined && (
                      <span className="mr-1 opacity-70 text-[10px]">{d.TenVietTat}</span>
                    )}
                    {d.MaKhoaDich} · {ngayVN(d.NgayThi)} ({d.SoDangKy})
                  </Link>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>

      <section className="the mt-5 overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#dfe4ec] bg-[#f7f9fc] text-left text-[12px] uppercase tracking-wide text-[#5c6878]">
              <th className="px-3 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Người đăng ký khai</th>
              <th className="px-3 py-3 font-semibold">
                Đối chiếu hồ sơ khóa cũ
              </th>
              <th className="px-3 py-3 font-semibold">Đợt ghép</th>
              <th className="px-3 py-3 font-semibold">Điện thoại</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {ds.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[#7a8494]"
                >
                  Chưa có ai đăng ký.
                </td>
              </tr>
            )}
            {dsTrang.map((d, i) => {
              const ck = d.CachKhop ? CACH_KHOP[d.CachKhop] : null;
              return (
                <tr
                  key={d.DangKyId}
                  className="border-b border-[#eef1f5] align-top last:border-0 hover:bg-[#fafbfd]"
                >
                  <td className="px-3 py-3 tabular-nums text-[#9aa4b4]">
                    {(trang - 1) * SO_DONG_MOI_TRANG + i + 1}
                  </td>

                  <td className="px-3 py-3">
                    <span className="font-semibold text-[#17202e]">
                      {d.HoTenKhai}
                    </span>
                    <div className="mt-0.5 text-[12px] tabular-nums text-[#5c6878]">
                      {ngayVN(d.NgaySinhKhai)} · {d.CccdKhai} · khai khóa{" "}
                      {d.MaKhoaGocKhai}
                    </div>
                    {d.DiaChiKhai && (
                      <div className="mt-0.5 text-[12px] text-[#7a8494]">
                        {d.DiaChiKhai}
                      </div>
                    )}
                    {d.GhiChuKhai && (
                      <div className="mt-0.5 text-[12px] italic text-[#7a8494]">
                        “{d.GhiChuKhai}”
                      </div>
                    )}
                    {d.GiaoVien && (
                      <div className="mt-0.5 text-[12px] text-[#7a8494]">
                        GV: {d.GiaoVien}
                      </div>
                    )}
                    {d.TrangThai === "TU_CHOI" && (
                      <div className="mt-1 max-w-[220px] rounded bg-[#fdf3f2] px-1.5 py-1 text-[11px] leading-snug text-[#8f2a1d]">
                        Trả lại{d.LyDoTuChoi ? `: ${d.LyDoTuChoi}` : ""}
                        {d.NguoiDuyet && (
                          <span className="block text-[#9aa4b4]">{d.NguoiDuyet}</span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {d.HocVienKhoaId ? (
                      <>
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${ck?.lop ?? ""}`}
                        >
                          {ck?.chu}
                        </span>
                        <div className="mt-1 text-[13px] text-[#17202e]">
                          {d.MaKhoaGocHoSo}
                          {d.KetQuaKhoaGoc && (
                            <span className="text-[#7a8494]">
                              {" "}
                              · {d.KetQuaKhoaGoc}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] tabular-nums text-[#7a8494]">
                          {d.MaHocVien}
                        </div>
                        {d.LechCccd && (
                          <div className="mt-1 text-[12px] font-medium text-[#8f2a1d]">
                            CCCD hồ sơ: {d.CccdHoSo}
                          </div>
                        )}
                        {d.LechKhoa && (
                          <div className="text-[12px] font-medium text-[#7a5a12]">
                            khai lệch khóa
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[13px] text-[#8f2a1d]">
                        Không tìm thấy hồ sơ
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-3 py-3">
                    {d.MaKhoaDich}
                    <div className="text-[12px] text-[#7a8494]">
                      {ngayVN(d.NgayThi)}
                    </div>
                    {pv === undefined && (
                      <div className="text-[11px] text-[#9aa4b4]">
                        {d.TenVietTat}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3 tabular-nums">{d.SoDienThoai}</td>

                  <td className="px-3 py-3">
                    <div className="flex flex-col items-end gap-1 text-[12px]">
                      {!d.HocVienKhoaId && <DoiChieuLai dangKyId={d.DangKyId} />}
                      {d.TrangThai !== "TU_CHOI" && (
                        <TraLai dangKyId={d.DangKyId} />
                      )}
                      <form action={xoaDangKy}>
                        <input type="hidden" name="id" value={d.DangKyId} />
                        <button className="text-[#8f2a1d] underline underline-offset-2 hover:no-underline">
                          Xóa
                        </button>
                      </form>
                    </div>
                  </td>
                </tr> 
              );
            })}
          </tbody>
        </table>
      </section>

      {tongTrang > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3 text-[13px]">
          <Link
            href={duongDanTrang(trang - 1)}
            aria-disabled={trang <= 1}
            className={`rounded-md border px-3 py-1.5 ${
              trang <= 1
                ? "pointer-events-none border-[#e5e9f0] text-[#c3cad6]"
                : "border-[#c8d2e0] text-[#4a5666] hover:bg-[#eaf2f9]"
            }`}
          >
            ← Trước
          </Link>
          <span className="tabular-nums text-[#5c6878]">
            Trang {trang}/{tongTrang}
          </span>
          <Link
            href={duongDanTrang(trang + 1)}
            aria-disabled={trang >= tongTrang}
            className={`rounded-md border px-3 py-1.5 ${
              trang >= tongTrang
                ? "pointer-events-none border-[#e5e9f0] text-[#c3cad6]"
                : "border-[#c8d2e0] text-[#4a5666] hover:bg-[#eaf2f9]"
            }`}
          >
            Sau →
          </Link>
        </nav>
      )}
    </main>
  );
}
