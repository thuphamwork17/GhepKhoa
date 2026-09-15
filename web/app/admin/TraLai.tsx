"use client";

import { useState } from "react";
import { doiTrangThai } from "../actions";

/** Lược đồ bắt buộc có lý do khi trả lại, nên phải hỏi trước khi gửi. */
export default function TraLai({ dangKyId }: { dangKyId: number }) {
  const [mo, setMo] = useState(false);

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="text-[#7a5a12] underline underline-offset-2 hover:no-underline"
      >
        Trả lại
      </button>
    );
  }

  return (
    <form action={doiTrangThai} className="w-[210px] space-y-1.5 text-left">
      <input type="hidden" name="id" value={dangKyId} />
      <input type="hidden" name="trangThai" value="TU_CHOI" />
      <input
        name="lyDo"
        required
        autoFocus
        maxLength={300}
        placeholder="Lý do trả lại…"
        className="o-nhap !py-1.5 !text-[12px]"
      />
      <div className="flex gap-2">
        <button className="rounded border border-[#e3c07a] bg-[#fdf8ec] px-2 py-1 text-[12px] font-medium text-[#7a5a12]">
          Gửi
        </button>
        <button
          type="button"
          onClick={() => setMo(false)}
          className="px-1 text-[12px] text-[#7a8494] underline underline-offset-2"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
