"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { goiYHocVien, themDongNhap, type GoiY, type KetQua } from "../actions";

export type DotChonNhanh = {
  DotId: number;
  MaKhoaDich: string;
  TenVietTat: string;
  NgayThi: string; // yyyy-mm-dd
};

/**
 * Bảng nhập nhanh — luôn hiện sẵn ở đầu trang, không phụ thuộc việc đang lọc
 * theo đợt nào bên dưới. Chọn đợt ngay trong form này rồi gõ là được, không
 * phải bấm vào một đợt cụ thể ở thanh lọc trước mới nhập được.
 *
 * Mỗi lần gửi: thêm một người vào đợt đã chọn, đối chiếu với hồ sơ khóa cũ
 * ngay lập tức (gọi Python ở phía server, chờ xong mới quay lại) rồi hiện
 * kết quả khớp/không khớp bên dưới ô nhập.
 *
 * Sau khi gửi thành công, chỉ xóa ô Họ tên — giữ nguyên đợt và Khóa cũ, vì
 * thực tế nhiều người liên tiếp cùng một đợt, cùng một khóa cũ (xem file mẫu
 * "TN ...xlsx"), gõ lại mỗi dòng một lần là phí công.
 *
 * Gõ Họ tên (đã có Khóa cũ) thì sau 350ms ngừng gõ, tự gợi ý những người
 * trùng một phần tên trong đúng khóa đó, kèm ngày sinh nhỏ bên dưới — bấm
 * vào gợi ý điền luôn cả tên (đúng chính tả có dấu) và ngày sinh, để phân
 * biệt ngay từ lúc gõ thay vì phải đợi bấm "Thêm" rồi mới biết bị trùng tên.
 */
export default function NhapNhanh({
  dots,
  dotMacDinh,
}: {
  dots: DotChonNhanh[];
  dotMacDinh?: number;
}) {
  const [kq, gui, dangGui] = useActionState<KetQua, FormData>(themDongNhap, {
    ok: false,
  });
  const oHoTen = useRef<HTMLInputElement>(null);
  // Không đồng bộ dotMacDinh vào state qua effect — cha truyền key khác nhau
  // theo dotMacDinh (xem nơi gọi), nên đổi đợt lọc là component này tự được
  // dựng lại từ đầu, state khởi tạo đúng ngay từ đầu chứ không cần effect.
  const [dotId, setDotId] = useState<number | "">(
    dotMacDinh ?? dots[0]?.DotId ?? "",
  );

  const [hoTen, setHoTen] = useState("");
  const [khoaGoc, setKhoaGoc] = useState("");
  const [ngaySinh, setNgaySinh] = useState("");

  const [goiY, setGoiY] = useState<GoiY[]>([]);
  const [hienGoiY, setHienGoiY] = useState(false);
  const demGoiY = useRef(0);

  // Xóa ô Họ tên/Ngày sinh ngay khi kq đổi (sau khi gửi thành công) — chỉnh
  // state lúc render thay vì trong effect (mẫu React khuyến nghị cho "suy ra
  // state từ props/kết quả đổi"), tránh bị cảnh báo set-state-in-effect.
  const [kqTruoc, setKqTruoc] = useState(kq);
  if (kq !== kqTruoc) {
    setKqTruoc(kq);
    if (kq.ok && !kq.loi) {
      setHoTen("");
      setNgaySinh("");
    }
  }
  // focus() là thao tác DOM thật, phải nằm trong effect — nhưng effect này
  // không gọi setState nào cả nên không vướng rule set-state-in-effect.
  useEffect(() => {
    if (kq.ok && !kq.loi) oHoTen.current?.focus();
  }, [kq]);

  // Gợi ý theo tên đang gõ, có debounce — không gọi server mỗi
  // phím gõ, chỉ gọi khi ngừng gõ 800ms để tránh quá tải server.
  // Đánh số lần gọi để bỏ qua kết quả trả về trễ của lần gọi cũ hơn.
  // Không gọi setGoiY([]) đồng bộ khi tên/khóa chưa đủ điều kiện — thay vào
  // đó dangHienGoiY (tính lúc render) tự ẩn danh sách cũ, không cần dọn state.
  const dieuKienGoiYHopLe =
    hoTen.trim().length >= 2 && dotId !== "" && !dangGui;
  useEffect(() => {
    const ten = hoTen.trim();
    const khoa = khoaGoc.trim();
    if (ten.length < 2 || dotId === "" || dangGui) return;
    const idHen = ++demGoiY.current;
    const hen = setTimeout(() => {
      goiYHocVien(Number(dotId), ten, khoa).then((ds) => {
        if (idHen === demGoiY.current) setGoiY(ds);
      });
    }, 800);
    return () => clearTimeout(hen);
  }, [hoTen, khoaGoc, dotId, dangGui]);

  const chonGoiY = (g: GoiY) => {
    setHoTen(g.hoTen);
    if (g.ngaySinh) setNgaySinh(g.ngaySinh);
    if (g.maKhoaGoc) setKhoaGoc(g.maKhoaGoc);
    setGoiY([]);
    setHienGoiY(false);
    oHoTen.current?.focus();
  };

  const daKhop = kq.ok && kq.thongBao?.startsWith("Đã thêm và khớp");
  const dangHienGoiY = hienGoiY && dieuKienGoiYHopLe && goiY.length > 0;

  if (!dots.length) {
    return (
      <section className="the mb-5 p-4 text-[13px] text-[#7a8494]">
        Chưa có đợt nào để nhập. Mở một đợt ở{" "}
        <a
          href="/admin/dot"
          className="text-[#0b5590] underline underline-offset-2"
        >
          Lịch thi
        </a>{" "}
        trước.
      </section>
    );
  }

  return (
    <section className="the mb-5 p-4">
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#0b5590]">
        Nhập nhanh — tự động đối chiếu ngay
      </h2>
      <form action={gui} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
        <label className="block w-full sm:w-auto">
          <span className="block text-[12px] font-semibold text-[#334155]">
            Đợt ghép <span className="text-[#c0392b]">*</span>
          </span>
          <select
            name="dotId"
            required
            value={dotId}
            onChange={(e) => setDotId(Number(e.target.value))}
            className="o-nhap mt-1 w-full sm:w-56"
          >
            {dots.map((d) => (
              <option key={d.DotId} value={d.DotId}>
                {d.MaKhoaDich} · {ngay(d.NgayThi)} · {d.TenVietTat}
              </option>
            ))}
          </select>
        </label>

        <label className="relative block w-full sm:w-auto">
          <span className="block text-[12px] font-semibold text-[#334155]">
            Họ và tên <span className="text-[#c0392b]">*</span>
          </span>
          <input
            ref={oHoTen}
            name="hoTen"
            required
            autoFocus
            autoComplete="off"
            placeholder="NGUYỄN VĂN A"
            value={hoTen}
            onChange={(e) => {
              setHoTen(e.target.value);
              setHienGoiY(true);
            }}
            onFocus={() => setHienGoiY(true)}
            onBlur={() => setTimeout(() => setHienGoiY(false), 150)}
            className="o-nhap mt-1 w-full sm:w-56"
          />
          {dangHienGoiY && (
            <ul className="the absolute left-0 top-full z-10 mt-1 max-h-56 w-full sm:w-64 overflow-y-auto py-1">
              {goiY.map((g, i) => (
                <li key={i}>
                  <button
                    type="button"
                    // onMouseDown (không phải onClick) để chạy trước onBlur của ô nhập.
                    onMouseDown={() => chonGoiY(g)}
                    className="block w-full px-3 py-1.5 text-left hover:bg-[#eaf2f9]"
                  >
                    <span className="block text-[13px] font-medium text-[#17202e]">
                      {g.hoTen} {g.maKhoaGoc && <span className="font-normal text-[#0b5590]">- Khóa: {g.maKhoaGoc}</span>}
                    </span>
                    <span className="block text-[11px] text-[#7a8494]">
                      {g.ngaySinh ? ngay(g.ngaySinh) : "chưa rõ ngày sinh"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <label className="block w-full sm:w-auto">
            <span className="block text-[12px] font-semibold text-[#334155]">
              Khóa cũ <span className="text-[#c0392b]">*</span>
            </span>
            <input
              name="khoaGoc"
              required
              placeholder="C1K52"
              value={khoaGoc}
              onChange={(e) => setKhoaGoc(e.target.value)}
              className="o-nhap mt-1 w-full sm:w-32"
            />
          </label>

          <label className="block w-full sm:w-auto">
            <span className="block text-[12px] font-semibold text-[#334155]">
              Giáo viên
            </span>
            <input
              name="giaoVien"
              placeholder="Tên giáo viên"
              className="o-nhap mt-1 w-full sm:w-44"
            />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <label className="block w-full sm:w-auto">
            <span className="block text-[12px] font-semibold text-[#334155]">
              Ngày sinh{" "}
              <span className="text-[11px] font-normal text-[#7a8494]">
                (nếu trùng tên)
              </span>
            </span>
            <input
              name="ngaySinh"
              type="date"
              value={ngaySinh}
              onChange={(e) => setNgaySinh(e.target.value)}
              className="o-nhap mt-1 w-full sm:w-40"
            />
          </label>

          <button
            type="submit"
            disabled={dangGui || dotId === ""}
            className="mt-1 sm:mt-0 w-full sm:w-auto rounded-lg bg-[#0b5590] px-5 py-2.5 sm:py-2 text-[13px] font-semibold text-white transition hover:bg-[#0a4878] disabled:opacity-60"
          >
            {dangGui ? "Đang đối chiếu…" : "Thêm"}
          </button>
        </div>
      </form>

      {kq.loi && (
        <p className="mt-2 text-[12px] text-[#c0392b]">
          {Object.values(kq.loi).join(" · ")}
        </p>
      )}
      {kq.thongBao && !kq.loi && (
        <p
          className={`mt-2 text-[13px] ${daKhop ? "text-[#215c2c]" : "text-[#7a5a12]"}`}
        >
          {kq.thongBao}
        </p>
      )}
    </section>
  );
}

function ngay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
