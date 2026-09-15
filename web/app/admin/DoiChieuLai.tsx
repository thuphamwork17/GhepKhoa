"use client";

import { useState } from "react";
import { doiChieuLai } from "../actions";

/** Đối chiếu lại một dòng chưa khớp. Bấm lần đầu thử luôn không cần thêm gì;
 *  nếu vẫn không ra (thường là trùng tên) thì mở thêm ô ngày sinh để phân biệt. */
export default function DoiChieuLai({ dangKyId }: { dangKyId: number }) {
  const [moRong, setMoRong] = useState(false);

  if (!moRong) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <form action={doiChieuLai}>
          <input type="hidden" name="id" value={dangKyId} />
          <button className="text-[#0b5590] underline underline-offset-2 hover:no-underline">
            Đối chiếu lại
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMoRong(true)}
          className="text-[11px] text-[#7a8494] underline underline-offset-2 hover:no-underline"
        >
          + ngày sinh
        </button>
      </div>
    );
  }

  return (
    <form action={doiChieuLai} className="w-[170px] space-y-1.5 text-left">
      <input type="hidden" name="id" value={dangKyId} />
      <input name="ngaySinh" type="date" required autoFocus className="o-nhap !py-1.5 !text-[12px]" />
      <div className="flex gap-2">
        <button className="rounded border border-[#0b5590] bg-[#eaf2f9] px-2 py-1 text-[12px] font-medium text-[#0b5590]">
          Đối chiếu lại
        </button>
        <button
          type="button"
          onClick={() => setMoRong(false)}
          className="px-1 text-[12px] text-[#7a8494] underline underline-offset-2"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
