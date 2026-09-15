import { execFile } from "node:child_process";

/**
 * Cầu nối gọi các script Python đã viết sẵn trong tools/ghepkhoa — quét kho
 * hồ sơ, đối chiếu với database GPLX, và điều khiển Excel qua COM để sinh
 * file .xls. Những việc đó không làm lại bằng Node được (đọc file .xls đời
 * cũ, tự động hóa Excel) nên gọi ra tiến trình Python riêng.
 *
 * Dùng execFile (không phải exec) — tham số đi thẳng vào mảng argv, không
 * qua shell, nên không sợ ký tự đặc biệt trong tên người/địa chỉ tiếng Việt
 * bị shell diễn giải sai.
 */

const THU_MUC_TOOLS = "D:\\GhepKhoa\\tools";

export type KetQuaPython<T> = { ok: true; du: T } | { ok: false; loi: string };

export async function goiPython<T = Record<string, unknown>>(
  lenh: "napmot" | "xuatweb" | "goiy",
  thamSo: unknown,
  thoiGianToiDaMs = 120_000,
): Promise<KetQuaPython<T>> {
  return new Promise((resolve) => {
    execFile(
      "python",
      ["-m", "ghepkhoa", lenh, "--json", JSON.stringify(thamSo)],
      {
        cwd: THU_MUC_TOOLS,
        timeout: thoiGianToiDaMs,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (loi, stdout, stderr) => {
        if (loi && (loi as NodeJS.ErrnoException).code === "ENOENT") {
          console.error(`goiPython ${lenh}: không thấy 'python' trên PATH`);
          resolve({ ok: false, loi: "Không tìm thấy Python trên máy chủ. Kiểm tra cài đặt." });
          return;
        }
        // Lệnh CLI luôn in đúng MỘT dòng JSON ở cuối stdout dù thành công hay
        // thất bại (xem __main__.py) — chỉ khi tiến trình chết bất thường
        // (crash, timeout) mới không có gì để parse.
        const dong = stdout
          .trim()
          .split(/\r?\n/)
          .filter(Boolean);
        const cuoi = dong[dong.length - 1];
        if (!cuoi) {
          console.error(`goiPython ${lenh}: không có output`, { loi, stderr: stderr?.slice(0, 2000) });
          resolve({ ok: false, loi: "Script Python không trả về kết quả. Xem log máy chủ." });
          return;
        }
        try {
          const kq = JSON.parse(cuoi) as { ok: boolean; loi?: string; thongBao?: string };
          if (kq.ok) resolve({ ok: true, du: kq as T });
          else resolve({ ok: false, loi: kq.loi ?? kq.thongBao ?? "Thất bại không rõ lý do." });
        } catch {
          console.error(`goiPython ${lenh}: JSON hỏng`, cuoi.slice(0, 500));
          resolve({ ok: false, loi: "Không đọc được kết quả từ script Python." });
        }
      },
    );
  });
}
