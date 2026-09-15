"use client";

import { useActionState } from "react";
import { napHoSo, type KetQuaNap } from "../../actions";

export default function NapFile({ dotId, muc }: { dotId: number; muc: { ma: string; ten: string }[] }) {
  const [kq, gui, dangGui] = useActionState<KetQuaNap, FormData>(napHoSo, { ok: false });

  return (
    <form action={gui} className="space-y-4">
      <input type="hidden" name="dotId" value={dotId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-[13px] font-semibold text-[#334155]">Mục cần nạp</span>
          <select name="maMuc" required className="o-nhap mt-1.5">
            <option value="">— Chọn mục —</option>
            {muc.map((m) => (
              <option key={m.ma} value={m.ma}>
                {m.ten}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-semibold text-[#334155]">Nếu cột Trạng thái trống</span>
          <select name="trangThaiMacDinh" defaultValue="DU" className="o-nhap mt-1.5">
            <option value="DU">Coi là Đủ</option>
            <option value="THIEU">Coi là Thiếu</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-semibold text-[#334155]">File (.csv, .xlsx)</span>
          <input
            type="file"
            name="tep"
            required
            accept=".csv,.xlsx"
            className="o-nhap mt-1.5 file:mr-3 file:rounded file:border-0 file:bg-[#eaf2f9] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[#0b5590]"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={dangGui}
        className="rounded-lg bg-[#0b5590] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#0a4878] disabled:opacity-60"
      >
        {dangGui ? "Đang nạp…" : "Nạp file"}
      </button>

      {kq.thongBao && (
        <p className={`text-[13px] ${kq.ok ? "text-[#215c2c]" : "text-[#c0392b]"}`}>{kq.thongBao}</p>
      )}

      {kq.khongKhop && kq.khongKhop.length > 0 && (
        <div className="rounded-lg border border-[#e3c07a] bg-[#fdf8ec] p-3 text-[13px]">
          <p className="font-semibold text-[#7a5a12]">
            {kq.khongKhop.length} dòng không khớp được người — kiểm tra lại tên/CCCD/khóa:
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[#7a5a12]">
            {kq.khongKhop.slice(0, 20).map((d) => (
              <li key={d.Dong}>
                dòng {d.Dong}: {d.HoTen || "(trống)"} {d.KhoaGoc ? `— ${d.KhoaGoc}` : ""}
              </li>
            ))}
            {kq.khongKhop.length > 20 && <li>… và {kq.khongKhop.length - 20} dòng nữa</li>}
          </ul>
        </div>
      )}
    </form>
  );
}
