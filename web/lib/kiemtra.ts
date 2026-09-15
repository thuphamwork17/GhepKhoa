/** Chuẩn hóa và kiểm tra dữ liệu người đăng ký nhập vào. */

export function chuanHoaTen(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim().toUpperCase();
}

// Cách viết tay cũ trên giấy — giữ đồng bộ với _BIET_DANH_HANG trong
// tools/ghepkhoa/dstn.py. Không đổi thì gõ "B(STĐ)K93" bị chặn ngay ở bước
// kiểm tra vì dấu ngoặc không nằm trong dạng mã khóa hợp lệ, dù đây là cách
// viết đúng và phía Python (tra database GPLX) đã hiểu được cách viết này.
const BIET_DANH_HANG: Record<string, string> = {
  "B(STD)": "B1",
  "B(STĐ)": "B1",
  BSTD: "B1",
};

export function chuanHoaMaKhoa(s: string): string {
  const t = s.normalize("NFC").replace(/\s+/g, "").trim().toUpperCase();
  const m = /^(.+?)K(\d{1,4})$/.exec(t);
  if (!m) return t;
  const hang = BIET_DANH_HANG[m[1]] ?? m[1];
  return `${hang}K${m[2]}`;
}

/** Chỉ giữ chữ số — CCCD dán từ nơi khác hay dính dấu chấm, khoảng trắng. */
export function chiSo(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Nhận dd/mm/yyyy hoặc yyyy-mm-dd, trả về yyyy-mm-dd để đưa thẳng vào cột DATE. */
export function chuanHoaNgay(s: string): string | null {
  const t = (s ?? "").trim();
  let d: number, m: number, y: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const vn = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (vn) [d, m, y] = [+vn[1], +vn[2], +vn[3]];
  else return null;

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const kt = new Date(Date.UTC(y, m - 1, d));
  if (kt.getUTCFullYear() !== y || kt.getUTCMonth() !== m - 1 || kt.getUTCDate() !== d) return null;
  // khớp CK_DK_NgaySinh trong lược đồ
  if (y < 1930 || y > 2020) return null;

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Date từ SQL Server (cột DATE) -> 'yyyy-mm-dd', không lệch múi giờ. */
export function ngayISO(d: Date | string | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** 'yyyy-mm-dd' -> 'dd/mm/yyyy' để hiển thị. */
export function ngayVN(d: Date | string | null | undefined): string {
  const iso = ngayISO(d);
  if (!iso) return "";
  const [y, m, dd] = iso.split("-");
  return `${dd}/${m}/${y}`;
}

export type DuLieuDangKy = {
  dotId: number;
  hoTen: string;
  khoaGoc: string;
  /* Ba trường dưới đây thường trống. Phiếu giấy trung tâm đang dùng chỉ ghi
     họ tên, khóa cũ và ngày muốn ghép; ngày sinh với CCCD đã nằm sẵn trong hồ
     sơ khóa cũ nên lấy ra lúc đối chiếu, không bắt người đăng ký khai lại. */
  ngaySinh: string | null;
  cccd: string | null;
  soDienThoai: string | null;
  diaChi: string | null;
  ghiChu: string | null;
  giaoVien: string | null;
};

export function kiemTraDangKy(f: FormData): { du?: DuLieuDangKy; loi: Record<string, string> } {
  const loi: Record<string, string> = {};
  const lay = (k: string) => String(f.get(k) ?? "").trim();
  const rong = (s: string) => (s === "" ? null : s);

  const dotId = Number(lay("dotId"));
  if (!Number.isInteger(dotId) || dotId <= 0) loi.dotId = "Chưa chọn đợt ghép khóa.";

  const hoTen = chuanHoaTen(lay("hoTen"));
  if (hoTen.split(" ").filter(Boolean).length < 2) loi.hoTen = "Nhập đầy đủ họ và tên.";
  else if (hoTen.length > 120) loi.hoTen = "Họ tên quá dài.";

  const khoaGoc = chuanHoaMaKhoa(lay("khoaGoc"));
  if (!/^[A-ZĐ0-9-]{1,12}K\d{1,4}$/.test(khoaGoc))
    loi.khoaGoc = "Mã khóa đã học không đúng dạng, ví dụ C1K52 hoặc BK134.";

  // Có nhập thì phải nhập cho đúng; bỏ trống thì không sao.
  const nsThô = lay("ngaySinh");
  const ngaySinh = nsThô ? chuanHoaNgay(nsThô) : null;
  if (nsThô && !ngaySinh) loi.ngaySinh = "Ngày sinh không hợp lệ.";

  const cccd = chiSo(lay("cccd"));
  if (cccd && cccd.length !== 12) loi.cccd = "Số CCCD phải đủ 12 chữ số.";

  const sdt = chiSo(lay("soDienThoai"));
  if (sdt && (sdt.length < 9 || sdt.length > 15)) loi.soDienThoai = "Số điện thoại không hợp lệ.";

  if (Object.keys(loi).length) return { loi };
  return {
    du: {
      dotId,
      hoTen,
      khoaGoc,
      ngaySinh,
      cccd: rong(cccd),
      soDienThoai: rong(sdt),
      diaChi: rong(lay("diaChi").replace(/\s+/g, " ").slice(0, 400)),
      ghiChu: rong(lay("ghiChu").replace(/\s+/g, " ").slice(0, 300)),
      giaoVien: rong(chuanHoaTen(lay("giaoVien")).slice(0, 120)),
    },
    loi,
  };
}
