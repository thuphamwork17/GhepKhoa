/** Tính lưới lịch tháng. Tuần bắt đầu từ Thứ Hai theo cách dùng ở Việt Nam. */

export const TEN_THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

export type ONgay = {
  iso: string; // yyyy-mm-dd
  ngay: number; // 1..31
  trongThang: boolean;
  laHomNay: boolean;
  laCuoiTuan: boolean; // T7 hoặc CN
};

function iso(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** 'YYYY-MM' hợp lệ thì giữ, không thì lấy tháng hiện tại. */
export function chuanHoaThang(s: string | undefined): string {
  if (s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export function dichThang(thang: string, buoc: number): string {
  const [y, m] = thang.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + buoc, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function tenThang(thang: string): string {
  const [y, m] = thang.split("-").map(Number);
  return `Tháng ${m} năm ${y}`;
}

/** Ngày đầu và cuối của tháng, dùng để giới hạn truy vấn. */
export function bienThang(thang: string): { tu: string; den: string } {
  const [y, m] = thang.split("-").map(Number);
  return {
    tu: iso(new Date(Date.UTC(y, m - 1, 1))),
    den: iso(new Date(Date.UTC(y, m, 0))),
  };
}

/**
 * Lưới 6 hàng × 7 cột phủ trọn tháng, đệm thêm ngày của tháng trước và tháng
 * sau cho đủ hàng — luôn 42 ô nên bố cục không nhảy khi đổi tháng.
 */
export function luoiThang(thang: string): ONgay[] {
  const [y, m] = thang.split("-").map(Number);
  const dau = new Date(Date.UTC(y, m - 1, 1));
  // getUTCDay: CN=0 … T7=6. Đổi sang T2=0 … CN=6.
  const lech = (dau.getUTCDay() + 6) % 7;
  const batDau = new Date(Date.UTC(y, m - 1, 1 - lech));

  const homNay = new Date();
  const isoHomNay = [
    homNay.getFullYear(),
    String(homNay.getMonth() + 1).padStart(2, "0"),
    String(homNay.getDate()).padStart(2, "0"),
  ].join("-");

  const ra: ONgay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(batDau.getTime() + i * 86_400_000);
    const s = iso(d);
    const thu = (d.getUTCDay() + 6) % 7;
    ra.push({
      iso: s,
      ngay: d.getUTCDate(),
      trongThang: d.getUTCMonth() === m - 1 && d.getUTCFullYear() === y,
      laHomNay: s === isoHomNay,
      laCuoiTuan: thu >= 5,
    });
  }
  return ra;
}
