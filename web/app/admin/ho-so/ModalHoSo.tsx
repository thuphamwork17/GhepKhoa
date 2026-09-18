"use client";

import { useState } from "react";
import { actionThemHoSo, actionSuaHoSo } from "@/app/actions";
import type { HoSoHocVien } from "@/lib/db";

export default function ModalHoSo({
  mode,
  initialData,
  defaultDonViId = 1,
  defaultMaKhoa = "",
  defaultHangMa = "C1",
  onClose,
  onSuccess,
}: {
  mode: "them" | "sua";
  initialData?: HoSoHocVien | null;
  defaultDonViId?: number;
  defaultMaKhoa?: string;
  defaultHangMa?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [donViId, setDonViId] = useState(initialData?.DonViId ?? defaultDonViId);
  const [hangMa, setHangMa] = useState(initialData?.HangMa ?? defaultHangMa);
  const [maKhoa, setMaKhoa] = useState(initialData?.MaKhoa ?? defaultMaKhoa);
  const [hoTen, setHoTen] = useState(initialData?.HoTen ?? "");
  const [ngaySinh, setNgaySinh] = useState(initialData?.NgaySinh ?? "");
  const [cccd, setCccd] = useState(initialData?.Cccd ?? "");
  const [soDienThoai, setSoDienThoai] = useState(initialData?.SoDienThoai ?? "");
  const [diaChi, setDiaChi] = useState(initialData?.DiaChi ?? "");
  const [giaoVien, setGiaoVien] = useState(initialData?.GiaoVien ?? "");

  const [giayKham, setGiayKham] = useState(initialData?.GiayKhamTrangThai ?? "CHUA_KIEM");
  const [donHoc, setDonHoc] = useState(initialData?.DonHocTrangThai ?? "DU");
  const [hopDong, setHopDong] = useState(initialData?.HopDongTrangThai ?? "CHUA_KIEM");
  const [bangKhai, setBangKhai] = useState(initialData?.BangKhaiTrangThai ?? "KHONG_CAN");
  const [cccdTT, setCccdTT] = useState(initialData?.CccdTrangThai ?? (initialData?.Cccd ? "DU" : "CHUA_KIEM"));
  const [hinh1M, setHinh1M] = useState(initialData?.Hinh1MTrangThai ?? "CHUA_KIEM");
  const [hocPhiTT, setHocPhiTT] = useState(initialData?.HocPhiTrangThai ?? "CHUA_KIEM");
  const [hocPhiTien, setHocPhiTien] = useState(initialData?.HocPhiSoTien ?? 0);
  const [ghiChu, setGhiChu] = useState(initialData?.GhiChu ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hoTen.trim()) {
      setError("Vui lòng nhập họ và tên học viên.");
      return;
    }
    if (!maKhoa.trim()) {
      setError("Vui lòng nhập mã khóa.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === "them") {
        const res = await actionThemHoSo({
          donViId,
          hangMa,
          maKhoa: maKhoa.trim().toUpperCase(),
          hoTen: hoTen.trim(),
          ngaySinh: ngaySinh.trim() || undefined,
          cccd: cccd.trim() || undefined,
          soDienThoai: soDienThoai.trim() || undefined,
          diaChi: diaChi.trim() || undefined,
          giaoVien: giaoVien.trim().toUpperCase() || undefined,
          giayKhamTrangThai: giayKham,
          donHocTrangThai: donHoc,
          hopDongTrangThai: hopDong,
          bangKhaiTrangThai: bangKhai,
          cccdTrangThai: cccdTT,
          hinh1MTrangThai: hinh1M,
          hocPhiTrangThai: hocPhiTT,
          hocPhiSoTien: Number(hocPhiTien) || 0,
          ghiChu: ghiChu.trim() || undefined,
        });

        if (!res.ok) {
          setError(res.thongBao ?? "Lỗi khi thêm hồ sơ.");
        } else {
          onSuccess();
          onClose();
        }
      } else if (mode === "sua" && initialData) {
        const res = await actionSuaHoSo(initialData.HoSoId, {
          hoTen: hoTen.trim(),
          ngaySinh: ngaySinh.trim() || undefined,
          cccd: cccd.trim() || undefined,
          soDienThoai: soDienThoai.trim() || undefined,
          diaChi: diaChi.trim() || undefined,
          giaoVien: giaoVien.trim().toUpperCase() || undefined,
          maKhoa: maKhoa.trim().toUpperCase() || undefined,
          ghiChu: ghiChu.trim() || undefined,
        });

        if (!res.ok) {
          setError(res.thongBao ?? "Lỗi khi cập nhật.");
        } else {
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-4 sm:my-8 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900">
              {mode === "them" ? "Thêm hồ sơ học viên mới" : `Chỉnh sửa hồ sơ: ${initialData?.HoTen}`}
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {mode === "them"
                ? "Nhập đầy đủ thông tin để khởi tạo hồ sơ và đồng bộ quản lý"
                : `Hồ sơ #${initialData?.HoSoId} · Khóa ${initialData?.MaKhoa}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-[13px] text-rose-700">
              {error}
            </div>
          )}

          {/* Section: Thông tin khóa & đơn vị */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Đơn vị đào tạo *
              </label>
              <select
                disabled={mode === "sua"}
                value={donViId}
                onChange={(e) => setDonViId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] disabled:bg-slate-100"
              >
                <option value={1}>Trường CĐ Tây Đô</option>
                <option value={2}>Trung tâm Tây Đô</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hạng GPLX *</label>
              <select
                disabled={mode === "sua"}
                value={hangMa}
                onChange={(e) => setHangMa(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] disabled:bg-slate-100"
              >
                <option value="B">Hạng B</option>
                <option value="B2">Hạng B2</option>
                <option value="BSTD">Hạng B (Số tự động)</option>
                <option value="C1">Hạng C1</option>
                <option value="B-D2">Hạng B-D2</option>
                <option value="CE">Hạng CE</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mã khóa *</label>
              <input
                type="text"
                value={maKhoa}
                onChange={(e) => setMaKhoa(e.target.value)}
                placeholder="VD: C1K90, BK140"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold uppercase text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
                required
              />
            </div>
          </div>

          {/* Section: Thông tin cá nhân học viên */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Họ và tên học viên *
              </label>
              <input
                type="text"
                value={hoTen}
                onChange={(e) => setHoTen(e.target.value)}
                placeholder="NGUYỄN VĂN A"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] uppercase font-semibold text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ngày sinh</label>
              <input
                type="text"
                value={ngaySinh}
                onChange={(e) => setNgaySinh(e.target.value)}
                placeholder="dd/mm/yyyy hoặc yyyy"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Số CCCD (12 số)</label>
              <input
                type="text"
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                placeholder="092200005851"
                maxLength={12}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-mono text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Số điện thoại</label>
              <input
                type="text"
                value={soDienThoai}
                onChange={(e) => setSoDienThoai(e.target.value)}
                placeholder="0901234567"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Giáo viên phụ trách</label>
              <input
                type="text"
                value={giaoVien}
                onChange={(e) => setGiaoVien(e.target.value)}
                placeholder="C BÍCH, T CƯỜNG AG..."
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] uppercase text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Địa chỉ thường trú</label>
              <input
                type="text"
                value={diaChi}
                onChange={(e) => setDiaChi(e.target.value)}
                placeholder="Ấp/Khu vực, Xã/Phường..."
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
              />
            </div>
          </div>

          {/* Section: Tình trạng giấy tờ hồ sơ (Khi thêm mới) */}
          {mode === "them" && (
            <div className="border-t border-slate-200 pt-3.5">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-800 mb-2.5">
                Tình trạng giấy tờ hồ sơ
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Giấy khám SK</label>
                  <select
                    value={giayKham}
                    onChange={(e) => setGiayKham(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-800"
                  >
                    <option value="DU">ĐỦ</option>
                    <option value="THIEU">THIẾU</option>
                    <option value="CAN_KY">CẦN KÝ</option>
                    <option value="CHUA_KIEM">CHƯA KIỂM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Đơn học</label>
                  <select
                    value={donHoc}
                    onChange={(e) => setDonHoc(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-800"
                  >
                    <option value="DU">ĐỦ</option>
                    <option value="THIEU">CẦN BỔ SUNG</option>
                    <option value="CHUA_KIEM">CHƯA KIỂM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Hợp đồng ĐT</label>
                  <select
                    value={hopDong}
                    onChange={(e) => setHopDong(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-800"
                  >
                    <option value="DU">ĐỦ</option>
                    <option value="THIEU">THIẾU</option>
                    <option value="CHUA_KIEM">CHƯA KIỂM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Bản khai (Nâng)</label>
                  <select
                    value={bangKhai}
                    onChange={(e) => setBangKhai(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-800"
                  >
                    <option value="KHONG_CAN">KHÔNG CẦN</option>
                    <option value="DU">ĐỦ</option>
                    <option value="THIEU">THIẾU</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Bản photo CCCD</label>
                  <select
                    value={cccdTT}
                    onChange={(e) => setCccdTT(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-800"
                  >
                    <option value="DU">ĐỦ</option>
                    <option value="THIEU">THIẾU</option>
                    <option value="CHUA_KIEM">CHƯA KIỂM</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ghi chú</label>
            <textarea
              rows={2}
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ghi chú thêm về hồ sơ học viên..."
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590]"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0b5590] px-5 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#094777] transition disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : mode === "them" ? "Lưu học viên" : "Cập nhật thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
