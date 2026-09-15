import crypto from "node:crypto";
import { cookies } from "next/headers";

import { motDong, sql, truyVan } from "./sql";

const TEN_COOKIE = "gk_phien";
const HAN_GIAY = 60 * 60 * 8;

export type NguoiDung = {
  NguoiDungId: number;
  TenDangNhap: string;
  HoTen: string;
  VaiTro: "QUAN_TRI" | "CAN_BO";
  DonViId: number | null;
  TenVietTat: string | null;
};

/* --------------------------------------------------------------- mật khẩu -- */

const N = 16384, r = 8, p = 1, DAI = 32;

/** Sinh chuỗi lưu vào cột MatKhauHash: scrypt$N$r$p$muối$băm (base64). */
export function bamMatKhau(matKhau: string): string {
  const muoi = crypto.randomBytes(16);
  const bam = crypto.scryptSync(matKhau.normalize("NFKC"), muoi, DAI, { N, r, p });
  return ["scrypt", N, r, p, muoi.toString("base64"), bam.toString("base64")].join("$");
}

export function kiemTraMatKhau(matKhau: string, luuTru: string): boolean {
  const phan = luuTru.split("$");
  if (phan.length !== 6 || phan[0] !== "scrypt") return false;
  const [, n, rr, pp, muoiB64, bamB64] = phan;
  const mong = Buffer.from(bamB64, "base64");
  let thu: Buffer;
  try {
    thu = crypto.scryptSync(matKhau.normalize("NFKC"), Buffer.from(muoiB64, "base64"), mong.length, {
      N: Number(n),
      r: Number(rr),
      p: Number(pp),
    });
  } catch {
    return false;
  }
  return mong.length === thu.length && crypto.timingSafeEqual(mong, thu);
}

/* ----------------------------------------------------------------- phiên -- */

function biMat(): string {
  const v = process.env.ADMIN_BIMAT;
  if (!v) throw new Error("Thiếu ADMIN_BIMAT trong web/.env.local — không ký được cookie phiên.");
  return v;
}

function ky(than: string): string {
  return crypto.createHmac("sha256", biMat()).update(than).digest("base64url");
}

function bangNhau(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function taoPhien(nguoiDungId: number): Promise<void> {
  const than = `${nguoiDungId}.${Math.floor(Date.now() / 1000) + HAN_GIAY}`;
  (await cookies()).set(TEN_COOKIE, `${than}.${ky(than)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HAN_GIAY,
  });
}

export async function xoaPhien(): Promise<void> {
  (await cookies()).delete(TEN_COOKIE);
}

/** Người dùng của phiên hiện tại, hoặc null nếu chưa đăng nhập / phiên hỏng. */
export async function nguoiDangNhap(): Promise<NguoiDung | null> {
  const c = (await cookies()).get(TEN_COOKIE)?.value;
  if (!c) return null;
  const i = c.lastIndexOf(".");
  if (i < 0) return null;
  const than = c.slice(0, i), chuKy = c.slice(i + 1);
  if (!bangNhau(chuKy, ky(than))) return null;

  const [idStr, hetHan] = than.split(".");
  if (Number(hetHan) <= Math.floor(Date.now() / 1000)) return null;

  const nd = await motDong<NguoiDung>(
    `SELECT n.NguoiDungId, n.TenDangNhap, n.HoTen, n.VaiTro, n.DonViId, d.TenVietTat
       FROM dbo.NguoiDung n
       LEFT JOIN dbo.DonVi d ON d.DonViId = n.DonViId
      WHERE n.NguoiDungId = @id AND n.DangHoatDong = 1`,
    { id: { kieu: sql.Int, gt: Number(idStr) } },
  );
  return nd ?? null;
}

/** Đăng nhập. Trả về người dùng nếu đúng, null nếu sai. */
export async function dangNhapBang(
  tenDangNhap: string,
  matKhau: string,
): Promise<NguoiDung | null> {
  const hang = await truyVan<NguoiDung & { MatKhauHash: string }>(
    `SELECT n.NguoiDungId, n.TenDangNhap, n.HoTen, n.VaiTro, n.DonViId, n.MatKhauHash,
            d.TenVietTat
       FROM dbo.NguoiDung n
       LEFT JOIN dbo.DonVi d ON d.DonViId = n.DonViId
      WHERE n.TenDangNhap = @ten AND n.DangHoatDong = 1`,
    { ten: { kieu: sql.VarChar(60), gt: tenDangNhap } },
  );
  const nd = hang[0];
  // Vẫn băm một lần dù không tìm thấy tài khoản, để thời gian phản hồi của
  // "sai tên đăng nhập" và "sai mật khẩu" như nhau.
  const hash = nd?.MatKhauHash ?? bamMatKhau("khong-ton-tai");
  if (!kiemTraMatKhau(matKhau, hash) || !nd) return null;

  await truyVan(
    `UPDATE dbo.NguoiDung SET LanDangNhapCuoi = SYSDATETIMEOFFSET() WHERE NguoiDungId = @id`,
    { id: { kieu: sql.Int, gt: nd.NguoiDungId } },
  );
  const { MatKhauHash: _bo, ...sach } = nd;
  void _bo;
  return sach;
}

/** Đơn vị mà người này được phép xem; null = xem tất cả. */
export function phamViDonVi(nd: NguoiDung): number | undefined {
  return nd.VaiTro === "QUAN_TRI" ? undefined : (nd.DonViId ?? undefined);
}

export async function coNguoiDungNao(): Promise<boolean> {
  const r = await motDong<{ n: number }>(`SELECT COUNT(*) AS n FROM dbo.NguoiDung`);
  return (r?.n ?? 0) > 0;
}
