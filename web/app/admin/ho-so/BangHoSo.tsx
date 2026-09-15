import { luuHoSo } from "../../actions";

type Muc = { id: number; ma: string; ten: string };
type Dong = {
  id: number;
  hoTen: string;
  khoaGoc: string;
  daKhop: boolean;
  trangThai: Record<number, string>;
};

const NHAN: Record<string, string> = {
  DU: "Đủ",
  THIEU: "Thiếu",
  KHONG_CAN: "Không cần",
  CHUA_KIEM: "Chưa kiểm",
};

const MAU_NEN: Record<string, string> = {
  DU: "bg-[#f1f8f2]",
  THIEU: "bg-[#fdf3f2]",
  KHONG_CAN: "bg-[#f4f6f9]",
  CHUA_KIEM: "bg-white",
};

/** Bảng chấm hồ sơ — mỗi ô một <select>, gửi cả bảng trong một lần submit.
 *  Không cần JavaScript để hoạt động: form HTML thuần, luuHoSo là server action. */
export default function BangHoSo({ dotId, muc, dong }: { dotId: number; muc: Muc[]; dong: Dong[] }) {
  if (!dong.length) {
    return (
      <div className="the p-8 text-center text-[14px] text-[#7a8494]">
        Đợt này chưa có ai đăng ký.
      </div>
    );
  }

  return (
    <form action={luuHoSo}>
      <input type="hidden" name="dotId" value={dotId} />

      {/* Đánh dấu nhanh cả cột — mỗi nút là một submit riêng của form riêng,
          không lẫn với bảng chấm chi tiết bên dưới. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[#5c6878]">
        <span className="font-semibold">Đánh dấu nhanh cả cột:</span>
        {muc.map((m) => (
          <span key={m.id} className="flex items-center gap-1">
            {m.ten}
            {(["DU", "THIEU"] as const).map((tt) => (
              <form key={tt} action={luuHoSo} className="inline">
                <input type="hidden" name="dotId" value={dotId} />
                <input type="hidden" name="batTatCa" value={`${m.id}:${tt}`} />
                <button
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${
                    tt === "DU"
                      ? "border-[#a9cfae] text-[#215c2c] hover:bg-[#f1f8f2]"
                      : "border-[#e0aaa3] text-[#8f2a1d] hover:bg-[#fdf3f2]"
                  }`}
                >
                  {NHAN[tt]}
                </button>
              </form>
            ))}
          </span>
        ))}
      </div>

      <div className="the overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#dfe4ec] bg-[#f7f9fc] text-left text-[12px] uppercase tracking-wide text-[#5c6878]">
              <th className="px-3 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Họ và tên</th>
              <th className="px-3 py-3 font-semibold">Khóa gốc</th>
              {muc.map((m) => (
                <th key={m.id} className="px-3 py-3 text-center font-semibold">
                  {m.ten}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dong.map((d, i) => (
              <tr key={d.id} className="border-b border-[#eef1f5] last:border-0 hover:bg-[#fafbfd]">
                <td className="px-3 py-2 tabular-nums text-[#9aa4b4]">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-[#17202e]">{d.hoTen}</span>
                  {!d.daKhop && (
                    <span className="ml-1.5 text-[11px] text-[#8f2a1d]">chưa khớp hồ sơ</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[#5c6878]">{d.khoaGoc}</td>
                {muc.map((m) => {
                  const tt = d.trangThai[m.id] ?? "CHUA_KIEM";
                  return (
                    <td key={m.id} className="px-2 py-1.5 text-center">
                      <select
                        name={`tt_${d.id}_${m.id}`}
                        defaultValue={tt}
                        className={`rounded border border-[#dfe4ec] px-1.5 py-1 text-[12px] ${MAU_NEN[tt]}`}
                      >
                        {Object.entries(NHAN).map(([gt, chu]) => (
                          <option key={gt} value={gt}>
                            {chu}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        className="mt-4 rounded-lg bg-[#0b5590] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#0a4878]"
      >
        Lưu bảng chấm
      </button>
    </form>
  );
}
