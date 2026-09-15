"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { luuDot, type KetQua } from "../../actions";

/** Chuẩn hóa sơ bộ ngay lúc gõ — chuẩn hóa đầy đủ (biệt danh B(STĐ)...) nằm
 *  ở server (chuanHoaMaKhoa trong lib/kiemtra.ts), ở đây chỉ cần đủ để
 *  hiển thị tag gọn gàng, không trùng lặp. */
function chuanHoaSoBo(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, "").trim().toUpperCase();
}

export default function FormDot({
  donVis,
  donViCoDinh,
  ngayThiMacDinh = "",
}: {
  donVis: { id: number; ten: string }[];
  donViCoDinh: { id: number; ten: string } | null;
  /** yyyy-mm-dd lấy từ ô ngày vừa bấm trên lịch. */
  ngayThiMacDinh?: string;
}) {
  const [kq, gui, dangGui] = useActionState<KetQua, FormData>(luuDot, { ok: false });
  const form = useRef<HTMLFormElement>(null);

  const [maKhoaTags, setMaKhoaTags] = useState<string[]>([]);
  const [maKhoaDangGo, setMaKhoaDangGo] = useState("");

  // Reset state (tag) sau khi lưu thành công — chỉnh lúc render (mẫu React
  // khuyến nghị) thay vì trong effect, tránh cảnh báo set-state-in-effect.
  const [kqTruoc, setKqTruoc] = useState(kq);
  if (kq !== kqTruoc) {
    setKqTruoc(kq);
    if (kq.ok) {
      setMaKhoaTags([]);
      setMaKhoaDangGo("");
    }
  }
  // form.reset() là thao tác DOM thật, phải nằm trong effect — effect này
  // không gọi setState nào nên không vướng rule set-state-in-effect.
  useEffect(() => {
    if (kq.ok) form.current?.reset();
  }, [kq]);

  const themTag = () => {
    const t = chuanHoaSoBo(maKhoaDangGo);
    if (t && !maKhoaTags.includes(t)) setMaKhoaTags([...maKhoaTags, t]);
    setMaKhoaDangGo("");
  };

  const nhan = "text-[13px] font-semibold text-[#334155]";

  return (
    <form ref={form} action={gui} className="space-y-4">
      {/* Cán bộ chỉ tạo được đợt cho đơn vị mình; quản trị thì phải chọn. */}
      {donViCoDinh ? (
        <p className="rounded-lg border border-[#dfe4ec] bg-[#f7f9fc] px-3 py-2 text-[13px] text-[#5c6878]">
          Đơn vị: <span className="font-semibold text-[#0b5590]">{donViCoDinh.ten}</span>
        </p>
      ) : (
        <label className="block">
          <span className={nhan}>
            Đơn vị tổ chức <span className="text-[#c0392b]">*</span>
          </span>
          <select name="donViId" required defaultValue="" className="o-nhap mt-1.5">
            <option value="" disabled>
              — Chọn đơn vị —
            </option>
            {donVis.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ten}
              </option>
            ))}
          </select>
          {kq.loi?.donViId && (
            <span className="mt-1 block text-[12px] text-[#c0392b]">{kq.loi.donViId}</span>
          )}
        </label>
      )}

      <label className="block">
        <span className={nhan}>
          Mã khóa đích <span className="text-[#c0392b]">*</span>
        </span>
        <div
          className={`o-nhap mt-1.5 flex flex-wrap items-center gap-1.5 !h-auto min-h-[42px] py-1.5 ${kq.loi?.maKhoa ? "loi" : ""}`}
        >
          {maKhoaTags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-[#eaf2f9] px-2.5 py-1 text-[13px] font-medium text-[#0b5590]"
            >
              {t}
              <button
                type="button"
                onClick={() => setMaKhoaTags(maKhoaTags.filter((x) => x !== t))}
                className="text-[#0b5590]/70 hover:text-[#c0392b]"
                aria-label={`Bỏ ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            name="maKhoaDichGo"
            value={maKhoaDangGo}
            onChange={(e) => setMaKhoaDangGo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "," || e.key === " ") {
                e.preventDefault();
                themTag();
              } else if (e.key === "Backspace" && !maKhoaDangGo && maKhoaTags.length) {
                setMaKhoaTags(maKhoaTags.slice(0, -1));
              }
            }}
            onBlur={themTag}
            placeholder={maKhoaTags.length ? "Thêm mã khác…" : "BK100, gõ Enter để thêm — có thể thêm nhiều mã"}
            className="min-w-[140px] flex-1 border-0 p-0 text-[14px] outline-none"
          />
        </div>
        {maKhoaTags.map((t) => (
          <input key={t} type="hidden" name="maKhoaDich" value={t} />
        ))}
        {kq.loi?.maKhoa && <span className="mt-1 block text-[12px] text-[#c0392b]">{kq.loi.maKhoa}</span>}
      </label>

      <label className="block">
        <span className={nhan}>Tên hiển thị cho học viên</span>
        <input name="ten" placeholder="Ghép khóa B(STĐ)K100" className="o-nhap mt-1.5" />
        <span className="mt-1 block text-[12px] text-[#7a8494]">
          Bỏ trống sẽ tự đặt theo mã khóa.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={nhan}>
            Ngày thi <span className="text-[#c0392b]">*</span>
          </span>
          <input
            name="ngayThi"
            type="date"
            required
            // key: bấm sang ngày khác trên lịch thì ô này phải nhận ngày mới,
            // defaultValue không tự cập nhật nếu React giữ lại cùng một input.
            key={ngayThiMacDinh}
            defaultValue={ngayThiMacDinh}
            className={`o-nhap mt-1.5 ${kq.loi?.ngayThi ? "loi" : ""}`}
          />
          {kq.loi?.ngayThi && (
            <span className="mt-1 block text-[12px] text-[#c0392b]">{kq.loi.ngayThi}</span>
          )}
        </label>
        <label className="block">
          <span className={nhan}>Hạn đăng ký</span>
          <input
            name="hanDangKy"
            type="date"
            className={`o-nhap mt-1.5 ${kq.loi?.hanDangKy ? "loi" : ""}`}
          />
          {kq.loi?.hanDangKy && (
            <span className="mt-1 block text-[12px] text-[#c0392b]">{kq.loi.hanDangKy}</span>
          )}
        </label>
      </div>

      <label className="block">
        <span className={nhan}>Địa điểm thi</span>
        <input name="diaDiemThi" placeholder="Sân sát hạch…" className="o-nhap mt-1.5" />
      </label>

      <label className="block">
        <span className={nhan}>Số lượng tối đa</span>
        <input
          name="soLuongToiDa"
          type="number"
          min={1}
          placeholder="Bỏ trống = không giới hạn"
          className="o-nhap mt-1.5"
        />
      </label>

      <label className="flex items-center gap-2.5 rounded-lg border border-[#dfe4ec] bg-[#f7f9fc] px-3 py-2.5">
        <input name="dangMo" type="checkbox" defaultChecked className="size-4 accent-[#0b5590]" />
        <span className="text-[14px] text-[#334155]">Mở cho học viên đăng ký ngay</span>
      </label>

      {kq.thongBao && (
        <p className={`text-[13px] ${kq.ok ? "text-[#215c2c]" : "text-[#c0392b]"}`}>
          {kq.thongBao}
        </p>
      )}

      <button
        disabled={dangGui}
        className="w-full rounded-lg bg-[#0b5590] px-4 py-2.5 font-semibold text-white transition hover:bg-[#0a4878] disabled:opacity-60"
      >
        {dangGui ? "Đang lưu…" : "Lưu đợt"}
      </button>
    </form>
  );
}
