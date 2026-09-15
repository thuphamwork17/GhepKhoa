"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ThongKeKhoa } from "@/lib/db";

export default function DanhSachKhoa({
  danhSachKhoa,
}: {
  danhSachKhoa: ThongKeKhoa[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = (maKhoa: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("khoa", maKhoa);
    params.delete("trang"); // Reset page
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  if (danhSachKhoa.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <svg
          className="mx-auto h-12 w-12 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-4 text-[15px] font-semibold text-slate-900">Không có dữ liệu khóa</h3>
        <p className="mt-1.5 text-[13px] text-slate-500">
          Chưa có khóa đào tạo nào được đồng bộ vào hệ thống.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {danhSachKhoa.map((k) => {
        const tileDu = k.TongSo > 0 ? ((k.SoDu / k.TongSo) * 100).toFixed(1) : "0";
        
        return (
          <button
            key={k.MaKhoa}
            onClick={() => handleClick(k.MaKhoa)}
            className="group flex flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-[#0b5590] hover:shadow-md text-left"
          >
            {/* Header Thẻ */}
            <div className="w-full flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <div className="text-[18px] font-bold tracking-tight text-slate-900 group-hover:text-[#0b5590] transition-colors">
                  {k.MaKhoa}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                    Hạng {k.HangMa}
                  </span>
                  <span className="text-[12px] text-slate-500 font-medium">
                    {k.TongSo} học viên
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-slate-50 p-2 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#0b5590] transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>

            {/* Thống kê nhỏ */}
            <div className="w-full grid grid-cols-3 gap-2">
              <div className="flex flex-col rounded-lg bg-emerald-50/50 p-2 border border-emerald-100/50">
                <span className="text-[10px] font-semibold uppercase text-emerald-700/80">Đủ HS</span>
                <span className="mt-0.5 text-[15px] font-bold text-emerald-700 font-mono">{k.SoDu}</span>
              </div>
              <div className="flex flex-col rounded-lg bg-rose-50/50 p-2 border border-rose-100/50">
                <span className="text-[10px] font-semibold uppercase text-rose-700/80">Thiếu</span>
                <span className="mt-0.5 text-[15px] font-bold text-rose-700 font-mono">{k.SoThieu}</span>
              </div>
              <div className="flex flex-col rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Chưa kiểm</span>
                <span className="mt-0.5 text-[15px] font-bold text-slate-700 font-mono">{k.SoChuaKiem}</span>
              </div>
            </div>

            {/* Thanh tiến độ */}
            <div className="mt-4 w-full">
              <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1.5">
                <span>Tiến độ hoàn thiện hồ sơ</span>
                <span className="text-emerald-700 font-semibold">{tileDu}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${tileDu}%` }}
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
