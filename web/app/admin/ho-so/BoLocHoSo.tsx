"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";

type BoLocProps = {
  khoas: string[];
  giaoViens: string[];
  phamVi: number | null | undefined;
  donViChon: number;
  hangChon: string;
  khoaChon: string;
  gvChon: string;
  trangThaiChon: string;
  tuKhoaChon: string;
  ngayGhepChon?: string;
  coNutQuayLai?: boolean;
};

export default function BoLocHoSo({
  khoas,
  giaoViens,
  phamVi,
  donViChon,
  hangChon,
  khoaChon,
  gvChon,
  trangThaiChon,
  tuKhoaChon,
  ngayGhepChon = "",
  coNutQuayLai,
}: BoLocProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tuKhoa, setTuKhoa] = useState(tuKhoaChon);

  const resetTatCa = () => {
    router.replace(pathname, { scroll: false });
  };

  useEffect(() => {
    setTuKhoa(tuKhoaChon);
  }, [tuKhoaChon]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "TAT_CA") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("trang"); // Reset page when filtering
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const qUrl = searchParams.get("q") ?? "";
    if (tuKhoa.trim() !== qUrl && (tuKhoa.trim() || qUrl)) {
      const timer = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (tuKhoa.trim()) {
          params.set("q", tuKhoa.trim());
        } else {
          params.delete("q");
        }
        params.delete("trang");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tuKhoa, pathname, router, searchParams]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* Đơn vị - chỉ hiển thị cho quản trị viên cấp cao */}
        {phamVi === null && (
          <select
            value={donViChon.toString()}
            onChange={(e) => setParam("donVi", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] focus:outline-hidden"
          >
            <option value="1">Trường CĐ Tây Đô</option>
            <option value="92004">Trung tâm Tây Đô</option>
          </select>
        )}

        {/* Khóa */}
        <select
          value={khoaChon}
          onChange={(e) => setParam("khoa", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] focus:outline-hidden max-w-[200px]"
        >
          <option value="TAT_CA">-- Tất cả khóa --</option>
          {khoas.map((k) => (
            <option key={k} value={k}>
              Khóa {k}
            </option>
          ))}
        </select>

        {/* Ngày ghép khóa */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-[#0b5590] focus-within:ring-1 focus-within:ring-[#0b5590]">
          <span className="text-[12px] text-slate-500 whitespace-nowrap">Ghép ngày:</span>
          <input
            type="date"
            value={ngayGhepChon}
            onChange={(e) => setParam("ngayGhep", e.target.value)}
            className="border-none bg-transparent p-0 text-[13px] text-slate-800 focus:ring-0 outline-hidden w-28"
          />
        </div>

        {/* Giáo viên */}
        <select
          value={gvChon}
          onChange={(e) => setParam("gv", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] focus:outline-hidden max-w-[200px]"
        >
          <option value="TAT_CA">-- Tất cả giáo viên --</option>
          {giaoViens.map((gv) => (
            <option key={gv} value={gv}>
              {gv}
            </option>
          ))}
        </select>

        {/* Trạng thái hồ sơ */}
        <select
          value={trangThaiChon}
          onChange={(e) => setParam("trangThai", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] focus:outline-hidden"
        >
          <option value="TAT_CA">-- Tất cả hồ sơ --</option>
          <option value="DU">Đủ hồ sơ</option>
          <option value="THIEU">Thiếu giấy tờ</option>
          <option value="CHUA_KIEM">Chưa kiểm tra</option>
        </select>

        {/* Thanh tìm kiếm */}
        <div className="relative w-full sm:w-80 shrink-0">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={tuKhoa}
            onChange={(e) => setTuKhoa(e.target.value)}
            placeholder="Tìm theo họ tên, CCCD, SĐT..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] shadow-2xs transition focus:outline-hidden"
          />
          {tuKhoa && (
            <button
              onClick={() => {
                setTuKhoa("");
                setParam("q", "");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Nút reset / quay lại */}
        {coNutQuayLai && (
          <button
            onClick={resetTatCa}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shrink-0 shadow-2xs"
            title="Quay lại danh sách các khóa"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Quay lại
          </button>
        )}
      </div>
    </div>
  );
}
