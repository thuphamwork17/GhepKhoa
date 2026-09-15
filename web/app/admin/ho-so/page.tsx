import { redirect } from "next/navigation";
import { nguoiDangNhap, phamViDonVi } from "@/lib/auth";
import {
  dsKhoaHoSo,
  dsGiaoVienHoSo,
  thongKeHoSo,
  timKiemHoSo,
  thongKeCacKhoa,
} from "@/lib/db";
import BoLocHoSo from "./BoLocHoSo";
import BangHoSoKhoa from "./BangHoSoKhoa";
import DanhSachKhoa from "./DanhSachKhoa";

export const dynamic = "force-dynamic";

export default async function TrangHoSo({
  searchParams,
}: {
  searchParams: Promise<{
    donVi?: string;
    hang?: string;
    khoa?: string;
    gv?: string;
    trangThai?: string;
    ngayGhep?: string;
    q?: string;
    trang?: string;
    soDong?: string;
  }>;
}) {
  const nd = await nguoiDangNhap();
  if (!nd) redirect("/dang-nhap");
  const pv = phamViDonVi(nd);

  const sp = await searchParams;
  const donViId = pv ?? (Number(sp.donVi) || 1);
  const hangMa = sp.hang && sp.hang !== "TAT_CA" ? sp.hang : undefined;
  const maKhoa = sp.khoa && sp.khoa !== "TAT_CA" ? sp.khoa : undefined;
  const giaoVien = sp.gv && sp.gv !== "TAT_CA" ? sp.gv : undefined;
  const trangThai = sp.trangThai && sp.trangThai !== "TAT_CA" ? sp.trangThai : undefined;
  const ngayGhep = sp.ngayGhep && sp.ngayGhep !== "TAT_CA" ? sp.ngayGhep : undefined;
  const tuKhoa = sp.q?.trim() || undefined;
  const trang = Math.max(Number(sp.trang) || 1, 1);
  const soDong = Math.min(Math.max(Number(sp.soDong) || 50, 10), 200);

  // Parallel loading for fast response
  const [khoas, giaoViens, thongKe, dsThongKeKhoa, ketQua] = await Promise.all([
    dsKhoaHoSo({ donViId: pv }),
    dsGiaoVienHoSo({ donViId, maKhoa }),
    thongKeHoSo({ donViId, maKhoa }),
    thongKeCacKhoa({ donViId }),
    timKiemHoSo({
      donViId,
      hangMa,
      maKhoa,
      giaoVien,
      trangThai,
      ngayGhep,
      tuKhoa,
      trang,
      soDong,
    }),
  ]);

  const tileDu = thongKe.Tong > 0 ? ((thongKe.SoDu / thongKe.Tong) * 100).toFixed(1) : "0";
  const hienThiBang = maKhoa || giaoVien || trangThai || ngayGhep || tuKhoa;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
              Quản lý Hồ sơ Đào tạo
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
              {khoas.length} khóa đào tạo
            </span>
          </div>
          <p className="mt-1 text-[13px] text-slate-500 leading-relaxed max-w-3xl">
            Theo dõi, kiểm tra tình trạng giấy tờ (giấy khám sức khỏe, đơn học, hợp đồng, bản khai nâng hạng, CCCD, ảnh 1M, học phí) của học viên các khóa.
          </p>
        </div>

        <div className="text-right">
          <span className="text-[12px] text-slate-500 font-medium">
            Phạm vi:{" "}
            <span className="font-semibold text-slate-900">
              {donViId === 1 ? "Trường CĐ Tây Đô" : "Trung tâm Tây Đô"}
            </span>
            {maKhoa && (
              <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                {maKhoa}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Tổng số hồ sơ</span>
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          </div>
          <div className="mt-2 text-[24px] font-bold tracking-tight text-slate-900 font-mono">
            {thongKe.Tong.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            {maKhoa ? `Khóa ${maKhoa}` : "Toàn bộ danh sách"}
          </div>
        </div>

        {/* DU */}
        <div className="rounded-xl border border-emerald-200/80 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
            <span>Đủ hồ sơ</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 text-[24px] font-bold tracking-tight text-emerald-700 font-mono">
            {thongKe.SoDu.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.2 border border-emerald-200">
              {tileDu}%
            </span>
            <span>đạt tiêu chuẩn</span>
          </div>
        </div>

        {/* THIEU */}
        <div className="rounded-xl border border-rose-200/80 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-rose-800">
            <span>Còn thiếu giấy tờ</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <div className="mt-2 text-[24px] font-bold tracking-tight text-rose-700 font-mono">
            {thongKe.SoThieu.toLocaleString("vi-VN")}
          </div>
          
        </div>

        {/* CHUA KIEM */}
        <div className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <span>Chưa kiểm tra</span>
            <span className="h-2 w-2 rounded-full bg-amber-400" />
          </div>
          <div className="mt-2 text-[24px] font-bold tracking-tight text-amber-700 font-mono">
            {thongKe.SoChuaKiem.toLocaleString("vi-VN")}
          </div>
          
        </div>

        {/* Breakdown of missing items */}
        
      </div>

      {/* Filter Toolbar */}
      <BoLocHoSo
        khoas={khoas}
        giaoViens={giaoViens}
        phamVi={pv}
        donViChon={donViId}
        hangChon={hangMa || "TAT_CA"}
        khoaChon={maKhoa || "TAT_CA"}
        gvChon={giaoVien || "TAT_CA"}
        trangThaiChon={trangThai || "TAT_CA"}
        tuKhoaChon={tuKhoa || ""}
        ngayGhepChon={ngayGhep || ""}
        coNutQuayLai={!!hienThiBang}
      />

      {/* Main Content */}
      {hienThiBang ? (
        <BangHoSoKhoa
          danhSach={ketQua.danhSach}
          tong={ketQua.tong}
          trangHienTai={ketQua.trang}
          soDongMoiTrang={ketQua.soDong}
          tongTrang={ketQua.tongTrang}
        />
      ) : (
        <DanhSachKhoa danhSachKhoa={dsThongKeKhoa} />
      )}
    </main>
  );
}
