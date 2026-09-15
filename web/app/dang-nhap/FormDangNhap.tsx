"use client";

import { useActionState } from "react";
import { dangNhap, type KetQua } from "../actions";

export default function FormDangNhap() {
  const [kq, gui, dangGui] = useActionState<KetQua, FormData>(dangNhap, { ok: false });
  return (
    <form action={gui} className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-semibold text-[#334155]">Tên đăng nhập</span>
        <input
          name="tenDangNhap"
          required
          autoFocus
          autoComplete="username"
          className="o-nhap mt-1.5"
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-semibold text-[#334155]">Mật khẩu</span>
        <input
          name="matKhau"
          type="password"
          required
          autoComplete="current-password"
          className="o-nhap mt-1.5"
        />
      </label>
      {kq.thongBao && <p className="text-[13px] text-[#c0392b]">{kq.thongBao}</p>}
      <button
        disabled={dangGui}
        className="w-full rounded-lg bg-[#0b5590] px-4 py-2.5 font-semibold text-white transition hover:bg-[#0a4878] disabled:opacity-60"
      >
        {dangGui ? "Đang kiểm tra…" : "Đăng nhập"}
      </button>
    </form>
  );
}
