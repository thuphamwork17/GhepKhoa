"use client";

import { useActionState } from "react";
import { xuatFileGhepKhoa, type KetQuaXuat } from "../actions";

/** Bấm là chạy Python + Excel COM ở máy chủ, chờ vài giây rồi báo đường dẫn
 *  file trên Desktop — không tự tải xuống được vì file nằm ngay trên máy này. */
export default function XuatFile({ dotId }: { dotId: number }) {
  const [kq, gui, dangGui] = useActionState<KetQuaXuat, FormData>(xuatFileGhepKhoa, { ok: false });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={gui}>
        <input type="hidden" name="dotId" value={dotId} />
        <button
          disabled={dangGui}
          className="rounded-lg bg-[#0b5590] px-3.5 py-2 text-[14px] font-semibold text-white transition hover:bg-[#0a4878] disabled:opacity-60"
        >
          {dangGui ? "Đang xuất… (vài giây)" : "Xuất file DS ghép khóa"}
        </button>
      </form>
      {kq.thongBao && (
        <p
          className={`max-w-xs text-right text-[12px] leading-snug ${
            kq.ok ? "text-[#215c2c]" : "text-[#c0392b]"
          }`}
        >
          {kq.thongBao}
          {kq.fileRa && (
            <>
              <br />
              <span className="font-mono text-[11px] text-[#5c6878]">{kq.fileRa}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
