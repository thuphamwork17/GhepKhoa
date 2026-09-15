import { readFile } from "node:fs/promises";

import { NextRequest } from "next/server";

import { nguoiDangNhap, phamViDonVi } from "@/lib/auth";
import { dsDangKy, layDot, mauVanBanCuaDonVi } from "@/lib/db";
import { ngayISO, ngayVN } from "@/lib/kiemtra";
import { goiPython } from "@/lib/python";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Cột xuất ra khớp đúng cột của file DS ghép khóa chính thức (bản Python/Excel
   COM sinh ra qua nút "Xuất file ghép khóa") — SBD, Họ và Tên, Ngày Sinh,
   CMND, Địa Chỉ, kí tên (để trống, dùng khi in giấy), Ghi Chú (khóa cũ đã
   học), rồi đến các cột tham chiếu hạng/số GPLX/mã học viên. Đợt ghép/Ngày
   thi/Đơn vị/Điện thoại xếp cuối, chỉ thật sự cần khi xuất gộp nhiều đợt
   ("Tất cả đợt") — file chính thức của từng đợt không có các cột này vì đã
   cố định trong tiêu đề. Giá trị ưu tiên lấy từ HỒ SƠ khóa cũ, chỉ khi chưa
   đối chiếu được mới dùng bản tự khai.                                      */
const COT = [
  { khoa: "sbd", nhan: "SBD", rong: 6 },
  { khoa: "hoTen", nhan: "Họ và Tên", rong: 30 },
  { khoa: "ngaySinh", nhan: "Ngày Sinh", rong: 12 },
  { khoa: "cccd", nhan: "CMND", rong: 16 },
  { khoa: "diaChi", nhan: "Địa Chỉ", rong: 46 },
  { khoa: "kiTen", nhan: "kí tên", rong: 12 },
  { khoa: "ghiChu", nhan: "Ghi Chú", rong: 13 },
  { khoa: "hangGplx", nhan: "Hạng GPLX đã có", rong: 15 },
  { khoa: "soGplx", nhan: "Số GPLX đã có", rong: 16 },
  { khoa: "maHocVien", nhan: "Mã học viên", rong: 32 },
  { khoa: "khoaDich", nhan: "Đợt ghép vào", rong: 13 },
  { khoa: "ngayThi", nhan: "Ngày thi", rong: 12 },
  { khoa: "donVi", nhan: "Đơn vị", rong: 14 },
  { khoa: "soDienThoai", nhan: "Điện thoại", rong: 14 },
  { khoa: "giaoVien", nhan: "Giáo viên", rong: 20 },
] as const;

export async function GET(req: NextRequest) {
  const nd = await nguoiDangNhap().catch((e) => {
    console.error("xuat: doc phien that bai", e);
    return null;
  });
  if (!nd) return new Response("Chưa đăng nhập hoặc phiên đã hết hạn.", { status: 401 });
  const pv = phamViDonVi(nd);

  const sp = req.nextUrl.searchParams;
  const dinhDang = sp.get("dinhDang") === "xlsx" ? "xlsx" : "csv";
  // Mặc định chỉ xuất bản đã duyệt — đó mới là danh sách dùng để lập DS dự thi.
  const chiDuyet = sp.get("tatCa") !== "1";

  let dotId = Number(sp.get("dot")) || undefined;
  if (dotId) {
    const dot = await layDot(dotId);
    if (!dot || (pv !== undefined && dot.DonViId !== pv)) dotId = undefined;
  }

  const dsGoc = (await dsDangKy({ dotId, donViId: pv })).filter((d) =>
    chiDuyet ? d.TrangThai === "DUYET" : true,
  );

  // Chưa chọn hẳn một đợt qua URL (đang xem "Tất cả đợt") nhưng dữ liệu lọc
  // ra chỉ thuộc đúng một đợt duy nhất — vẫn coi như đã chọn đợt đó, để "Tải
  // Excel" xuất đúng văn bản chính thức thay vì rơi về bảng dữ liệu thô chỉ
  // vì admin chưa bấm vào thanh lọc đợt trước khi tải.
  if (!dotId && dsGoc.length) {
    const dotIdDuyNhat = new Set(dsGoc.map((d) => d.DotId));
    if (dotIdDuyNhat.size === 1) dotId = dsGoc[0].DotId;
  }

  const ds = dsGoc.map((d, i) => ({
      sbd: String(i + 1),
      hoTen: d.HoTenHoSo ?? d.HoTenKhai,
      ngaySinh: ngayVN(d.NgaySinhHoSo ?? d.NgaySinhKhai),
      cccd: d.CccdHoSo ?? d.CccdKhai,
      diaChi: d.DiaChiHoSo ?? d.DiaChiKhai ?? "",
      kiTen: "",
      ghiChu: d.MaKhoaGocHoSo ?? d.MaKhoaGocKhai,
      hangGplx: d.HangGplxDaCo ?? "",
      soGplx: d.SoGplxDaCo ?? "",
      maHocVien: d.MaHocVien ?? "",
      khoaDich: d.MaKhoaDich,
      ngayThi: ngayVN(d.NgayThi),
      donVi: d.TenVietTat,
      soDienThoai: d.SoDienThoai,
      giaoVien: d.GiaoVien ?? "",
    }));

  const dot = dotId ? await layDot(dotId) : undefined;
  const ten =
    `dangky-ghepkhoa${dot ? "-" + dot.MaKhoaDich : ""}` +
    `-${new Date().toISOString().slice(0, 10)}.${dinhDang}`;

  // Đã chọn đúng một đợt (nên biết đơn vị nào, dùng đúng một file mẫu) thì
  // "Tải Excel" phải là chính văn bản chính thức — cùng một đường sinh file
  // với nút "Xuất file ghép khóa" (dstn.sinh_file qua Excel COM), chỉ khác
  // là trả thẳng file về trình duyệt tải xuống, không lưu ra Desktop. Không
  // làm vậy thì người dùng tải "Tải Excel" ra chỉ được một bảng dữ liệu thô,
  // không giống file mẫu có tiêu đề/khung ký tên/font VNI như file thật.
  if (dinhDang === "xlsx" && dot) {
    const mau = await mauVanBanCuaDonVi(dot.DonViId);
    if (mau && ds.length) {
      const rows = ds.map((r) => ({
        hoTen: r.hoTen,
        ngaySinh: r.ngaySinh,
        cccd: r.cccd,
        diaChi: r.diaChi,
        hangGplx: r.hangGplx,
        soGplx: r.soGplx,
        maHocVien: r.maHocVien,
        maKhoaGoc: r.ghiChu,
      }));
      const kq = await goiPython<{ fileRa: string; soDong: number }>(
        "xuatweb",
        { maKhoaDich: dot.MaKhoaDich, ngayThi: ngayISO(dot.NgayThi), fileMau: mau, rows },
        180_000,
      );
      if (kq.ok) {
        const buf = await readFile(kq.du.fileRa);
        const tenChinhThuc = `DS ghep khoa TN VOI ${dot.MaKhoaDich} ${ngayVN(dot.NgayThi).replaceAll("/", "-")}.xls`;
        return new Response(new Uint8Array(buf), {
          headers: {
            "Content-Type": "application/vnd.ms-excel",
            "Content-Disposition": `attachment; filename="${tenChinhThuc}"`,
          },
        });
      }
      console.error("xuat xlsx chinh thuc that bai, roi ve bang tho:", kq.loi);
    }
  }

  if (dinhDang === "csv") {
    const dong = (o: string[]) => o.map(oCsv).join(",");
    // BOM để Excel trên Windows nhận đúng UTF-8 tiếng Việt.
    const noiDung =
      "﻿" +
      [
        dong(COT.map((c) => c.nhan)),
        ...ds.map((r) => dong(COT.map((c) => String(r[c.khoa] ?? "")))),
      ].join("\r\n");
    return new Response(noiDung, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${ten}"`,
      },
    });
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Đăng ký ghép khóa");
  ws.columns = COT.map((c) => ({ header: c.nhan, key: c.khoa, width: c.rong }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ds.forEach((r) => ws.addRow(r));

  // CCCD / điện thoại / số GPLX phải là chuỗi, nếu không Excel ăn mất số 0 đầu.
  for (const khoa of ["cccd", "soDienThoai", "soGplx"] as const) {
    const i = COT.findIndex((c) => c.khoa === khoa) + 1;
    ws.getColumn(i).numFmt = "@";
    ws.getColumn(i).alignment = { horizontal: "left" };
  }
  ws.autoFilter = { from: "A1", to: { row: 1, column: COT.length } };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ten}"`,
    },
  });
}

function oCsv(v: string) {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
