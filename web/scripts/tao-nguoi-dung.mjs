/**
 * Tạo hoặc đổi mật khẩu tài khoản cán bộ.
 *
 *   node scripts/tao-nguoi-dung.mjs <tenDangNhap> "<Họ tên>" <QUAN_TRI|CAN_BO> [maCoSo]
 *
 * Ví dụ:
 *   node scripts/tao-nguoi-dung.mjs admin  "Nguyễn Văn A" QUAN_TRI
 *   node scripts/tao-nguoi-dung.mjs cb.cdtd "Trần Thị B"  CAN_BO 92001
 *
 * Script gọi sqlcmd bằng Windows auth nên chạy được ngay cả khi chưa bật
 * TCP/IP — đây thường là việc đầu tiên phải làm, trước cả khi web kết nối được.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const MAY_CHU = process.env.SQL_INSTANCE ?? "ThuPham\\SQLEXPRESS";
const CSDL = process.env.SQL_CSDL ?? "DrivingManagement";

const [ten, hoTen, vaiTro, maCoSo] = process.argv.slice(2);

if (!ten || !hoTen || !vaiTro) {
  console.error(`Cách dùng:
  node scripts/tao-nguoi-dung.mjs <tenDangNhap> "<Họ tên>" <QUAN_TRI|CAN_BO> [maCoSo]

  QUAN_TRI  — thấy cả hai đơn vị, không cần maCoSo
  CAN_BO    — chỉ thấy đơn vị của mình, bắt buộc có maCoSo (92001 hoặc 92004)`);
  process.exit(1);
}
if (!["QUAN_TRI", "CAN_BO"].includes(vaiTro)) {
  console.error("Vai trò phải là QUAN_TRI hoặc CAN_BO.");
  process.exit(1);
}
if (vaiTro === "CAN_BO" && !maCoSo) {
  console.error("Vai trò CAN_BO bắt buộc phải kèm mã cơ sở (92001 hoặc 92004).");
  process.exit(1);
}

/* ---------------------------------------------------------------- mật khẩu */

function bamMatKhau(mk) {
  const N = 16384, r = 8, p = 1;
  const muoi = crypto.randomBytes(16);
  const bam = crypto.scryptSync(mk.normalize("NFKC"), muoi, 32, { N, r, p });
  return ["scrypt", N, r, p, muoi.toString("base64"), bam.toString("base64")].join("$");
}

function hoi(cauHoi) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Không echo mật khẩu ra màn hình.
    const ghiCu = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = function (s) {
      if (this.stdoutMuted) rl.output.write("*");
      else if (ghiCu) ghiCu(s);
      else rl.output.write(s);
    };
    rl.question(cauHoi, (a) => {
      rl.stdoutMuted = false;
      rl.output.write("\n");
      rl.close();
      resolve(a);
    });
    rl.stdoutMuted = true;
  });
}

// Đặt sẵn MAT_KHAU trong môi trường thì bỏ qua phần hỏi — dùng khi chạy script
// tự động. Bình thường nên để nó hỏi, mật khẩu không lọt vào lịch sử lệnh.
let mk1 = process.env.MAT_KHAU ?? "";
if (!mk1) {
  mk1 = await hoi(`Mật khẩu cho "${ten}": `);
  const mk2 = await hoi("Nhập lại: ");
  if (mk1 !== mk2) {
    console.error("Hai lần nhập không khớp.");
    process.exit(1);
  }
}
if (mk1.length < 8) {
  console.error("Mật khẩu phải từ 8 ký tự trở lên.");
  process.exit(1);
}

const hash = bamMatKhau(mk1);
const q = (s) => String(s).replace(/'/g, "''");

const sql = `
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @donVi int = ${maCoSo ? `(SELECT DonViId FROM dbo.DonVi WHERE MaCoSo = '${q(maCoSo)}')` : "NULL"};
${maCoSo ? `IF @donVi IS NULL BEGIN RAISERROR(N'Khong tim thay don vi co ma co so ${q(maCoSo)}', 16, 1); RETURN; END` : ""}

MERGE dbo.NguoiDung AS t
USING (SELECT N'${q(ten)}' AS TenDangNhap) AS n ON t.TenDangNhap = n.TenDangNhap
WHEN MATCHED THEN UPDATE SET
  HoTen = N'${q(hoTen)}', MatKhauHash = '${q(hash)}', VaiTro = '${q(vaiTro)}',
  DonViId = @donVi, DangHoatDong = 1, CapNhatLuc = SYSDATETIMEOFFSET()
WHEN NOT MATCHED THEN INSERT (TenDangNhap, HoTen, MatKhauHash, VaiTro, DonViId)
  VALUES (N'${q(ten)}', N'${q(hoTen)}', '${q(hash)}', '${q(vaiTro)}', @donVi);

-- Tra ve tung cot rieng, KHONG noi chuoi: cot HoTen dung COLLATE
-- Vietnamese_CI_AS con TenDangNhap dung collation mac dinh cua database, noi
-- hai cot khac collation bang toan tu + se loi 451 va hong ca batch.
SELECT n.TenDangNhap, n.HoTen, n.VaiTro,
       DonVi = ISNULL(d.TenVietTat, N'(toan he thong)')
  FROM dbo.NguoiDung n LEFT JOIN dbo.DonVi d ON d.DonViId = n.DonViId
 WHERE n.TenDangNhap = N'${q(ten)}';
`;

const tmp = path.join(os.tmpdir(), `gk_nd_${process.pid}.sql`);
fs.writeFileSync(tmp, sql, "utf8");
try {
  const r = spawnSync(
    "sqlcmd",
    ["-S", MAY_CHU, "-d", CSDL, "-E", "-C", "-b", "-I", "-f", "65001", "-i", tmp],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
} finally {
  fs.rmSync(tmp, { force: true });
}
