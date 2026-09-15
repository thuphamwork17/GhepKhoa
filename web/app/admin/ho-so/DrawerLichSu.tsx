"use client";

import { useEffect, useState } from "react";
import { actionLayLichSuHoSo } from "@/app/actions";
import type { LichSuHoSoItem } from "@/lib/db";

export default function DrawerLichSu({
  hoSoId,
  hoTen,
  onClose,
}: {
  hoSoId: number;
  hoTen: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<LichSuHoSoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      try {
        const res = await actionLayLichSuHoSo(hoSoId);
        if (!cancel) setItems(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [hoSoId]);

  const badgeHanhDong = (hd: string) => {
    switch (hd) {
      case "TAO_MOI":
        return <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">Tạo mới</span>;
      case "DOI_TRANG_THAI":
        return <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">Đổi trạng thái</span>;
      case "SUA_THONG_TIN":
        return <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200">Sửa thông tin</span>;
      case "XOA":
        return <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 border border-rose-200">Đã xóa</span>;
      default:
        return <span className="rounded bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">{hd}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity">
      <div
        className="h-full w-full max-w-lg bg-white shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">
              Lịch sử cập nhật hồ sơ
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Học viên: <span className="font-semibold text-slate-800">{hoTen}</span> · Mã #{hoSoId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            title="Đóng"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0b5590] border-t-transparent mb-3" />
              <p className="text-[13px]">Đang tải dữ liệu lịch sử...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-[14px]">
              Chưa có lịch sử cập nhật nào được ghi nhận.
            </div>
          ) : (
            <div className="relative border-l border-slate-200 ml-3 pl-5 space-y-6">
              {items.map((it) => {
                const dateObj = new Date(it.ThoiDiem);
                const dateStr = dateObj.toLocaleString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div key={it.LichSuId} className="relative group">
                    {/* Minimalist circle on timeline */}
                    <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0b5590] ring-1 ring-slate-300" />

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:border-slate-300">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[12px] text-slate-500 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          {badgeHanhDong(it.HanhDong)}
                          <span className="font-medium text-slate-800">
                            {it.NguoiDung || "Hệ thống"}
                          </span>
                        </div>
                        <time className="font-mono text-[11px] text-slate-400">{dateStr}</time>
                      </div>

                      <div className="mt-2 text-[13px] text-slate-700 leading-relaxed">
                        {it.TruongThayDoi && (
                          <div className="font-medium text-slate-900">
                            Mục: <span className="text-[#0b5590]">{it.TruongThayDoi}</span>
                          </div>
                        )}

                        {it.GiaTriCu && it.GiaTriMoi && (
                          <div className="mt-1 flex items-center gap-2 text-[12px]">
                            <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700 line-through border border-rose-100 font-mono">
                              {it.GiaTriCu}
                            </span>
                            <span className="text-slate-400 font-mono">→</span>
                            <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-100 font-mono">
                              {it.GiaTriMoi}
                            </span>
                          </div>
                        )}

                        {!it.GiaTriCu && it.GiaTriMoi && (
                          <div className="mt-1 text-[12px]">
                            Giá trị mới:{" "}
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-mono">
                              {it.GiaTriMoi}
                            </span>
                          </div>
                        )}

                        {it.GhiChu && (
                          <p className="mt-2 text-[12px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {it.GhiChu}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-3.5 bg-slate-50/80 text-right">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
