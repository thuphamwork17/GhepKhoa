"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCapNhatMucHoSo, actionXoaHoSo } from "@/app/actions";
import type { HoSoHocVien } from "@/lib/db";
import DrawerLichSu from "./DrawerLichSu";
import ModalHoSo from "./ModalHoSo";

export default function BangHoSoKhoa({
  danhSach,
  tong,
  trangHienTai,
  soDongMoiTrang,
  tongTrang,
}: {
  danhSach: HoSoHocVien[];
  tong: number;
  trangHienTai: number;
  soDongMoiTrang: number;
  tongTrang: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [historyTarget, setHistoryTarget] = useState<{ id: number; ten: string } | null>(null);
  const [editTarget, setEditTarget] = useState<HoSoHocVien | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleToggle = async (hoSoId: number, muc: string, giaTriMoi: string) => {
    setUpdatingId(hoSoId);
    try {
      const res = await actionCapNhatMucHoSo({ hoSoId, muc, giaTriMoi });
      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        alert(res.thongBao || "Lỗi khi cập nhật");
      }
    } catch (err: any) {
      alert(err?.message || "Lỗi mạng hoặc kết nối");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleXoa = async (hoSo: HoSoHocVien) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa hồ sơ học viên ${hoSo.HoTen} (Khóa ${hoSo.MaKhoa})?`)) {
      return;
    }
    const lyDo = prompt("Lý do xóa (để lưu vào lịch sử):", "Cán bộ xóa từ giao diện quản trị");
    if (lyDo === null) return;

    try {
      const res = await actionXoaHoSo(hoSo.HoSoId, lyDo || undefined);
      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        alert(res.thongBao || "Lỗi khi xóa");
      }
    } catch (err: any) {
      alert(err?.message || "Lỗi khi xóa hồ sơ");
    }
  };

  const handleChuyenTrang = (trangMoi: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("trang", String(trangMoi));
    router.push(url.pathname + url.search);
  };

  const badgePill = (
    value: string,
    hoSoId: number,
    muc: string,
    options: { val: string; label: string; bg: string; text: string; border: string }[],
  ) => {
    const cur = options.find((o) => o.val === value) || options[0];
    const isBusy = updatingId === hoSoId;

    return (
      <div className="relative inline-block">
        <select
          disabled={isBusy}
          value={value}
          onChange={(e) => handleToggle(hoSoId, muc, e.target.value)}
          className={`appearance-none cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium border transition hover:opacity-80 focus:ring-1 focus:ring-[#0b5590] focus:outline-hidden disabled:opacity-50 ${cur.bg} ${cur.text} ${cur.border}`}
          title="Nhấp để đổi trạng thái"
        >
          {options.map((opt) => (
            <option key={opt.val} value={opt.val} className="bg-white text-slate-900 font-normal">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Table Header toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/70">
        <div className="text-[13px] text-slate-600">
          Hiển thị{" "}
          <span className="font-semibold text-slate-900 font-mono">
            {danhSach.length > 0 ? (trangHienTai - 1) * soDongMoiTrang + 1 : 0}
          </span>{" "}
          –{" "}
          <span className="font-semibold text-slate-900 font-mono">
            {Math.min(trangHienTai * soDongMoiTrang, tong)}
          </span>{" "}
          trong tổng số{" "}
          <span className="font-bold text-[#0b5590] font-mono">{tong.toLocaleString("vi-VN")}</span> hồ sơ
        </div>

        {isPending && (
          <span className="text-[12px] font-medium text-[#0b5590] flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0b5590] border-t-transparent" />
            Đang tải dữ liệu...
          </span>
        )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <th className="py-3 px-3.5 text-center w-12">STT</th>
              <th className="py-3 px-3.5">Học viên & Khóa</th>
              <th className="py-3 px-3.5 text-center">Giáo viên</th>
              <th className="py-3 px-2.5 text-center" title="Giấy khám sức khỏe">Giấy khám</th>
              <th className="py-3 px-2.5 text-center" title="Đơn đăng ký học lái xe">Đơn học</th>
              <th className="py-3 px-2.5 text-center" title="Hợp đồng đào tạo">Hợp đồng</th>
              <th className="py-3 px-2.5 text-center" title="Bản khai GPLX cũ khi nâng hạng">Bản khai</th>
              <th className="py-3 px-2.5 text-center" title="Bản photo CCCD/CMND">CCCD</th>
              <th className="py-3 px-3 text-center w-32">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {danhSach.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-slate-500 text-[14px]">
                  Không tìm thấy hồ sơ học viên nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              danhSach.reduce((rows, hs, idx) => {
                const prevHs = idx > 0 ? danhSach[idx - 1] : null;
                const isNewKhoa = !prevHs || prevHs.MaKhoa !== hs.MaKhoa;

                // Thêm dòng tiêu đề cho khóa mới
                if (isNewKhoa) {
                  rows.push(
                    <tr key={`khoa-${hs.MaKhoa}`} className="bg-slate-100/80 font-semibold text-slate-800 border-b border-slate-200">
                      <td colSpan={9} className="py-2.5 px-3.5 text-left text-[12px]">
                        Khóa: <span className="text-[#0b5590]">{hs.MaKhoa}</span> 
                        <span className="font-normal text-slate-500 ml-2">— Hạng {hs.HangMa}</span>
                      </td>
                    </tr>
                  );
                }

                const stt = (trangHienTai - 1) * soDongMoiTrang + idx + 1;

                rows.push(
                  <tr
                    key={hs.HoSoId}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* STT */}
                    <td className="py-3 px-3 text-center font-mono text-[12px] text-slate-400">
                      {stt}
                    </td>

                    {/* Học viên */}
                    <td className="py-3 px-3.5">
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-[#0b5590] transition-colors flex items-center gap-1.5">
                          <span>{hs.HoTen}</span>
                          <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            {hs.MaKhoa}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5 font-mono">
                          {hs.NgaySinh && <span>NS: {hs.NgaySinh}</span>}
                          {hs.Cccd && <span>CCCD: {hs.Cccd}</span>}
                          {hs.SoDienThoai && <span className="text-slate-700">ĐT: {hs.SoDienThoai}</span>}
                        </div>
                        {hs.DiaChi && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5" title={hs.DiaChi}>
                            {hs.DiaChi}
                          </div>
                        )}
                          {(() => {
                            const missingDocs = [];
                            if (hs.GiayKhamTrangThai !== "DU") missingDocs.push("KSK");
                            if (hs.DonHocTrangThai !== "DU" && hs.DonHocTrangThai !== "KHONG_CAN") missingDocs.push("Đơn");
                            if (hs.BangKhaiTrangThai !== "DU" && hs.BangKhaiTrangThai !== "KHONG_CAN") missingDocs.push("BK");
                            if (hs.CccdTrangThai !== "DU") missingDocs.push("CCCD");
                            
                            return (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {missingDocs.length > 0 ? (
                                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                    Thiếu: {missingDocs.join(", ")}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Đủ hồ sơ
                                  </span>
                                )}

                                {/* Đợt ghép */}
                                {hs.MaKhoaDich ? (
                                  <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200 flex items-center gap-1" title="Đã xếp vào đợt thi">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {hs.MaKhoaDich}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 border-dashed">
                                    Chưa xếp đợt
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    </td>

                    {/* Giáo viên */}
                    <td className="py-3 px-3 text-center text-[12px] font-medium text-slate-700">
                      {hs.GiaoVien || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Giấy khám SK */}
                    <td className="py-3 px-2.5 text-center">
                      {badgePill(hs.GiayKhamTrangThai, hs.HoSoId, "GiayKham", [
                        { val: "DU", label: "Đủ KSK", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                        { val: "THIEU", label: "Thiếu KSK", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
                        { val: "CAN_KY", label: "Cần ký", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
                        { val: "CHUA_KIEM", label: "Chưa kiểm", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
                      ])}
                    </td>

                    {/* Đơn học */}
                    <td className="py-3 px-2.5 text-center">
                      {badgePill(hs.DonHocTrangThai, hs.HoSoId, "DonHoc", [
                        { val: "DU", label: "Đủ đơn", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                        { val: "THIEU", label: "Cần bổ sung", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
                        { val: "CHUA_KIEM", label: "Chưa kiểm", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
                      ])}
                    </td>

                    {/* Hợp đồng */}
                    <td className="py-3 px-2.5 text-center">
                      {badgePill(hs.HopDongTrangThai, hs.HoSoId, "HopDong", [
                        { val: "DU", label: "Đủ HĐ", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                        { val: "THIEU", label: "Thiếu HĐ", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
                        { val: "CHUA_KIEM", label: "Chưa kiểm", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
                      ])}
                    </td>

                    {/* Bản khai (Nâng hạng) */}
                    <td className="py-3 px-2.5 text-center">
                      {badgePill(hs.BangKhaiTrangThai, hs.HoSoId, "BangKhai", [
                        { val: "KHONG_CAN", label: "Không cần", bg: "bg-slate-50", text: "text-slate-400", border: "border-slate-200" },
                        { val: "DU", label: "Đủ BK", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                        { val: "THIEU", label: "Thiếu BK", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
                        { val: "CHUA_KIEM", label: "Chưa kiểm", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
                      ])}
                    </td>

                    {/* Bản photo CCCD */}
                    <td className="py-3 px-2.5 text-center">
                      {badgePill(hs.CccdTrangThai, hs.HoSoId, "Cccd", [
                        { val: "DU", label: "Đủ CCCD", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                        { val: "THIEU", label: "Thiếu CCCD", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
                        { val: "CHUA_KIEM", label: "Chưa kiểm", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
                      ])}
                    </td>

                    {/* Thao tác (Icon SVG cao cấp) */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Lịch sử: Icon Timeline / History */}
                        <button
                          type="button"
                          onClick={() => setHistoryTarget({ id: hs.HoSoId, ten: hs.HoTen })}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                          title="Xem lịch sử cập nhật"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        {/* Sửa: Icon Pencil */}
                        <button
                          type="button"
                          onClick={() => setEditTarget(hs)}
                          className="rounded-lg p-1.5 text-[#0b5590] hover:bg-blue-50 hover:text-[#094777] transition"
                          title="Chỉnh sửa thông tin"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>

                        {/* Xóa: Icon Trash */}
                        <button
                          type="button"
                          onClick={() => handleXoa(hs)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                          title="Xóa hồ sơ"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                return rows;
              }, [] as React.ReactNode[])
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {tongTrang > 1 && (
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 px-5 py-3 bg-slate-50/70 text-[13px]">
          <div className="text-slate-500">
            Trang <span className="font-semibold text-slate-900 font-mono">{trangHienTai}</span> / {tongTrang}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={trangHienTai <= 1}
              onClick={() => handleChuyenTrang(trangHienTai - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition font-medium text-[12px]"
            >
              Trước
            </button>

            {Array.from({ length: Math.min(5, tongTrang) }, (_, i) => {
              let pNum = trangHienTai - 2 + i;
              if (pNum < 1) pNum = i + 1;
              if (pNum > tongTrang) return null;

              return (
                <button
                  key={pNum}
                  onClick={() => handleChuyenTrang(pNum)}
                  className={`min-w-8 rounded-lg px-2.5 py-1.5 text-center text-[12px] font-medium transition ${
                    pNum === trangHienTai
                      ? "bg-[#0b5590] text-white font-bold"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              disabled={trangHienTai >= tongTrang}
              onClick={() => handleChuyenTrang(trangHienTai + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition font-medium text-[12px]"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* Drawer Lịch sử */}
      {historyTarget && (
        <DrawerLichSu
          hoSoId={historyTarget.id}
          hoTen={historyTarget.ten}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* Modal Sửa */}
      {editTarget && (
        <ModalHoSo
          mode="sua"
          initialData={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
