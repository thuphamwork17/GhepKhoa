"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function TimKiem() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [tuKhoa, setTuKhoa] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setTuKhoa(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const qUrl = searchParams.get("q") ?? "";
    // Chỉ cập nhật URL nếu tuKhoa (đã trim) khác với tuKhoa trên URL
    // hoặc nếu tuKhoa trống nhưng trên URL lại có q
    if (tuKhoa.trim() !== qUrl && (tuKhoa.trim() || qUrl)) {
      const hen = setTimeout(() => {
        const p = new URLSearchParams(searchParams.toString());
        if (tuKhoa.trim()) {
          p.set("q", tuKhoa.trim());
        } else {
          p.delete("q");
        }
        p.delete("trang");
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      }, 300);
      return () => clearTimeout(hen);
    }
  }, [tuKhoa, router, pathname, searchParams]);

  return (
    <div className="relative w-full sm:w-80 shrink-0">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <input
        type="text"
        placeholder="Tìm họ tên, CCCD, khóa cũ, giáo viên..."
        className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] shadow-sm transition"
        value={tuKhoa}
        onChange={(e) => setTuKhoa(e.target.value)}
      />
      {tuKhoa && (
        <button
          onClick={() => setTuKhoa("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
          aria-label="Xóa tìm kiếm"
        >
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
