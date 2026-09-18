"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ThongKeKhoa } from "@/lib/db";

function rutGonMaKhoa(ma: string) {
  // Trích xuất "K26D" từ "92004K26D2030"
  const m = ma.match(/K\d+[A-Z]*/i);
  return m ? m[0] : ma;
}

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
        const tileDu = k.TongSo > 0 ? ((k.SoDu / k.TongSo) * 100).toFixed(0) : "0";
        const tenKhoaNgan = rutGonMaKhoa(k.MaKhoa);
        
        return (
          <button
            key={k.MaKhoa}
            onClick={() => handleClick(k.MaKhoa)}
            className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-[#0b5590] hover:shadow-md text-left"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[20px] font-bold tracking-tight text-slate-900 group-hover:text-[#0b5590] transition-colors">
                    Khóa {tenKhoaNgan}
                  </div>
                  <div className="text-[12px] text-slate-400 font-mono mt-0.5">
                    {k.MaKhoa}
                  </div>
                </div>
                <div className="rounded-full bg-slate-50 p-2 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#0b5590] transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
              
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[12px] font-semibold text-blue-700 border border-blue-200">
                  Hạng {k.HangMa}
                </span>
                <span className="text-[13px] text-slate-500 font-medium">
                  • {k.TongSo} học viên
                </span>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600" title="Đủ hồ sơ">
                  <span className="size-2 rounded-full bg-emerald-500"></span>
                  {k.SoDu}
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-600" title="Thiếu giấy tờ">
                  <span className="size-2 rounded-full bg-rose-500"></span>
                  {k.SoThieu}
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-400" title="Chưa kiểm tra">
                  <span className="size-2 rounded-full bg-slate-300"></span>
                  {k.SoChuaKiem}
                </span>
              </div>
              <div className="text-[12px] font-semibold text-slate-400">
                {tileDu}%
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
