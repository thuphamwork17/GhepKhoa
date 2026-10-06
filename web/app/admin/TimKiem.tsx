"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function TimKiem() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const qUrl = searchParams.get("q") ?? "";

  const [tuKhoa, setTuKhoa] = useState(qUrl);
  const lastTypeTime = useRef(0);

  const handleChange = (val: string) => {
    lastTypeTime.current = Date.now();
    setTuKhoa(val);
  };

  const handleClear = () => {
    lastTypeTime.current = Date.now();
    setTuKhoa("");
  };

  // Đồng bộ từ URL về state (dành cho nút Back hoặc Clear bộ lọc từ ngoài)
  // Chỉ đồng bộ nếu người dùng đã ngừng gõ ít nhất 2 giây để tránh lỗi mất chữ do Next.js update URL chậm
  useEffect(() => {
    if (qUrl !== tuKhoa && Date.now() - lastTypeTime.current > 2000) {
      setTuKhoa(qUrl);
    }
  }, [qUrl, tuKhoa]);

  // Đẩy từ state lên URL
  useEffect(() => {
    const hen = setTimeout(() => {
      const currentTrimmed = tuKhoa.trim();
      const currentQ = searchParams.get("q") ?? "";
      
      // Chỉ push URL nếu thực sự có thay đổi so với URL hiện tại
      if (currentTrimmed !== currentQ) {
        const p = new URLSearchParams(searchParams.toString());
        if (currentTrimmed) {
          p.set("q", currentTrimmed);
        } else {
          p.delete("q");
        }
        p.delete("trang");
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      }
    }, 500); // Đợi 500ms sau khi ngừng gõ mới push
    return () => clearTimeout(hen);
  }, [tuKhoa, searchParams, pathname, router]);

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
        onChange={(e) => handleChange(e.target.value)}
      />
      {tuKhoa && (
        <button
          onClick={handleClear}
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
