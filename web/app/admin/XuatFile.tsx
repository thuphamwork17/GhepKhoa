"use client";

import { useState } from "react";

/** Bấm là gọi API để sinh file bằng Python + Excel COM, sau đó tải thẳng
 * file về máy của người dùng (client). */
export default function XuatFile({ dotId }: { dotId: number }) {
  const [dangGui, setDangGui] = useState(false);
  const [thongBao, setThongBao] = useState<{ ok: boolean; txt: string } | null>(null);

  const taiFile = async () => {
    setDangGui(true);
    setThongBao(null);
    try {
      const res = await fetch(`/api/xuat?dot=${dotId}&dinhDang=xlsx`);
      if (!res.ok) {
        const text = await res.text();
        setThongBao({ ok: false, txt: text || "Có lỗi xảy ra khi xuất file." });
        return;
      }
      
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = "DS_GhepKhoa.xls";
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches && matches[1]) filename = matches[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setThongBao({ ok: true, txt: "Đã tải file thành công!" });
    } catch (err) {
      setThongBao({ ok: false, txt: "Lỗi kết nối tải file." });
    } finally {
      setDangGui(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={taiFile}
        disabled={dangGui}
        className="rounded-lg bg-[#0b5590] px-3.5 py-2 text-[14px] font-semibold text-white transition hover:bg-[#0a4878] disabled:opacity-60"
      >
        {dangGui ? "Đang xuất… (vài giây)" : "Xuất và Tải file DS ghép khóa"}
      </button>
      {thongBao && (
        <p
          className={`max-w-xs text-right text-[12px] leading-snug ${
            thongBao.ok ? "text-[#215c2c]" : "text-[#c0392b]"
          }`}
        >
          {thongBao.txt}
        </p>
      )}
    </div>
  );
}
