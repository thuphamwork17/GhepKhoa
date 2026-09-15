"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  dangNhapBang,
  nguoiDangNhap,
  phamViDonVi,
  taoPhien,
  xoaPhien,
  type NguoiDung,
} from "@/lib/auth";
import { dsDangKy, layDangKy, layDot, mauVanBanCuaDonVi, timHocVienKhoaCu, doiChieuMotHocVien, GoiY } from "@/lib/db";
import { goiPython } from "@/lib/python";
import { goiThuTuc, loiNghiepVu, motDong, sql, truyVan } from "@/lib/sql";
import {
  chuanHoaMaKhoa,
  chuanHoaNgay,
  chuanHoaTen,
  kiemTraDangKy,
  ngayISO,
  ngayVN,
} from "@/lib/kiemtra";

export type KetQua = {
  ok: boolean;
  thongBao?: string;
  loi?: Record<string, string>;
  thieuHoSo?: string;
};

const LOI_CHUNG = "Hệ thống đang bận, vui lòng thử lại sau ít phút.";

/* -------------------------------------------------------------- nhật ký -- */

/** API nào được gọi kèm gì — đính vào một dòng Nhật ký để cả terminal lẫn
 *  /admin/log đều thấy được request/response thật, không chỉ một câu tóm tắt. */
type ChiTietGoi = { api: string; yeuCau?: unknown; phanHoi?: unknown };

/** Ghi một dòng vào NhatKy (trang /admin/log đọc từ đây) và in ra terminal
 *  luôn cho dev theo dõi trực tiếp lúc chạy — không chặn thao tác chính nếu
 *  việc ghi log bị lỗi, chỉ log ra console rồi thôi.
 *
 *  chiTiet (tùy chọn): tên API + request/response thật đã gửi/nhận — để
 *  debug không phải đoán, terminal in đầy đủ, /admin/log lưu kèm để xem lại
 *  sau. Trước đây chỉ có một câu tóm tắt thân thiện, thiếu hẳn phần này. */
async function ghiNhatKy(
  nd: NguoiDung | null,
  hanhDong: string,
  bang: string,
  khoaChinh: string | number | null,
  noiDung: string,
  chiTiet?: ChiTietGoi,
) {
  const dauDong = `[${new Date().toISOString()}] ${nd?.HoTen ?? "?"}#${nd?.NguoiDungId ?? "-"} ${hanhDong} ${bang}${khoaChinh != null ? "#" + khoaChinh : ""} — ${noiDung}`;
  console.log(dauDong);
  if (chiTiet) {
    console.log(`  API: ${chiTiet.api}`);
    if (chiTiet.yeuCau !== undefined) console.log("  Yêu cầu:", JSON.stringify(chiTiet.yeuCau));
    if (chiTiet.phanHoi !== undefined) console.log("  Phản hồi:", JSON.stringify(chiTiet.phanHoi));
  }

  const noiDungLuu = chiTiet
    ? `${noiDung}\n---\nAPI: ${chiTiet.api}\n${JSON.stringify(
        { yeuCau: chiTiet.yeuCau, phanHoi: chiTiet.phanHoi },
        null,
        2,
      )}`
    : noiDung;

  try {
    await truyVan(
      `INSERT dbo.NhatKy (NguoiDungId, HanhDong, Bang, KhoaChinh, NoiDung)
       VALUES (@nd, @hd, @b, @k, @nd2)`,
      {
        nd: { kieu: sql.Int, gt: nd?.NguoiDungId ?? null },
        hd: { kieu: sql.VarChar(40), gt: hanhDong },
        b: { kieu: sql.VarChar(40), gt: bang },
        k: { kieu: sql.VarChar(40), gt: khoaChinh != null ? String(khoaChinh) : null },
        nd2: { kieu: sql.NVarChar(sql.MAX), gt: noiDungLuu },
      },
    );
  } catch (e) {
    console.error("ghiNhatKy", e);
  }
}

/** Ghi một LỖI thật (ngoại lệ, thao tác thất bại) — cùng chỗ với ghiNhatKy
 *  (terminal + /admin/log) nhưng đánh dấu rõ "LỖI:" để phân biệt với thao
 *  tác bình thường, và trang log tô đỏ được. Trước đây nhiều nhánh lỗi chỉ
 *  console.error() một Error object trần trụi — không ai/lúc nào, cũng
 *  không hiện trên /admin/log — khiến việc dò lỗi phải mò trong terminal.
 *
 *  Stack trace đầy đủ CHỈ in ra terminal (không lưu vào NhatKy, tránh phình
 *  bảng vô ích) — trước đây terminal quá "thân thiện" (chỉ 1 câu), không đủ
 *  để dev debug; giờ có stack thật ngay bên dưới dòng tóm tắt. */
async function ghiLoi(
  nd: NguoiDung | null,
  hanhDong: string,
  bang: string,
  khoaChinh: string | number | null,
  chiTiet: unknown,
  chiTietGoi?: ChiTietGoi,
) {
  const chuoi = chiTiet instanceof Error ? chiTiet.message : String(chiTiet);
  if (chiTiet instanceof Error && chiTiet.stack) console.error(chiTiet.stack);
  await ghiNhatKy(nd, hanhDong, bang, khoaChinh, `LỖI: ${chuoi}`, chiTietGoi);
}

/* --------------------------------------------------------------- đăng nhập -- */

export async function dangNhap(_truoc: KetQua, f: FormData): Promise<KetQua> {
  const ten = String(f.get("tenDangNhap") ?? "").trim();
  const mk = String(f.get("matKhau") ?? "");
  if (!ten || !mk) return { ok: false, thongBao: "Nhập đủ tên đăng nhập và mật khẩu." };

  let nd: NguoiDung | null;
  try {
    nd = await dangNhapBang(ten, mk);
  } catch (e) {
    await ghiLoi(null, "DANG_NHAP", "NguoiDung", ten, e);
    return { ok: false, thongBao: LOI_CHUNG };
  }
  if (!nd) {
    console.log(`[${new Date().toISOString()}] đăng nhập thất bại: "${ten}"`);
    return { ok: false, thongBao: "Tên đăng nhập hoặc mật khẩu không đúng." };
  }

  await taoPhien(nd.NguoiDungId);
  await ghiNhatKy(nd, "DANG_NHAP", "NguoiDung", nd.NguoiDungId, "Đăng nhập");
  redirect("/admin");
}

export async function dangXuat() {
  const nd = await nguoiDangNhap().catch(() => null);
  if (nd) await ghiNhatKy(nd, "DANG_XUAT", "NguoiDung", nd.NguoiDungId, "Đăng xuất");
  await xoaPhien();
  redirect("/dang-nhap");
}

/* ------------------------------------------------------------------ admin -- */

async function batBuoc(): Promise<NguoiDung> {
  const nd = await nguoiDangNhap();
  if (!nd) redirect("/dang-nhap");
  return nd;
}

/** Chặn cán bộ đơn vị này thao tác lên đợt của đơn vị kia. */
async function batBuocQuyenTrenDot(nd: NguoiDung, dotId: number) {
  const pv = phamViDonVi(nd);
  if (pv === undefined) return;
  const dot = await layDot(dotId);
  if (!dot || dot.DonViId !== pv) redirect("/admin");
}

async function batBuocQuyenTrenDangKy(nd: NguoiDung, dangKyId: number) {
  const pv = phamViDonVi(nd);
  if (pv === undefined) return;
  const r = await truyVan<{ DonViId: number }>(
    `SELECT DonViId FROM dbo.vw_DangKy WHERE DangKyId = @id`,
    { id: { kieu: sql.Int, gt: dangKyId } },
  );
  if (!r[0] || r[0].DonViId !== pv) redirect("/admin");
}

export async function luuDot(_truoc: KetQua, f: FormData): Promise<KetQua> {
  const nd = await batBuoc();

  const id = Number(f.get("id") ?? 0);
  const pv = phamViDonVi(nd);
  const donViId = pv ?? Number(f.get("donViId") ?? 0);
  // Một đợt có thể khai nhiều mã khóa đích (tag) — mã đầu tiên vẫn là mã
  // "chính" lưu ở cột MaKhoaDich như trước (mọi chỗ in tiêu đề/tên file/lịch
  // đều đang dựa vào đúng MỘT mã nên không đổi); toàn bộ tag dùng để kiểm
  // tra "Khóa cũ" trùng khóa đích lúc đăng ký (xem DotMaKhoaDich, themDongNhap).
  const dsMaKhoaDich = [...new Set(
    [...f.getAll("maKhoaDich"), f.get("maKhoaDichGo")]
      .map((v) => chuanHoaMaKhoa(String(v ?? "")))
      .filter(Boolean),
  )];
  const reMaKhoa = /^[A-ZĐ0-9-]{1,12}K\d{1,4}$/;
  const dsMaKhoaHopLe = dsMaKhoaDich.filter((m) => reMaKhoa.test(m));
  const maKhoa = dsMaKhoaHopLe[0] ?? "";
  const ten = String(f.get("ten") ?? "").trim();
  const ngayThi = String(f.get("ngayThi") ?? "").trim();
  const hanDangKy = String(f.get("hanDangKy") ?? "").trim() || null;
  const soLuong = Number(f.get("soLuongToiDa") ?? 0) || null;
  const diaDiem = String(f.get("diaDiemThi") ?? "").trim() || null;
  const dangMo = f.get("dangMo") ? 1 : 0;

  const loi: Record<string, string> = {};
  if (!donViId) loi.donViId = "Chọn đơn vị tổ chức thi.";
  if (!dsMaKhoaDich.length) loi.maKhoa = "Nhập ít nhất một mã khóa đích, ví dụ BK100.";
  else if (!dsMaKhoaHopLe.length)
    loi.maKhoa = "Mã khóa đích không đúng dạng, ví dụ BK100 hoặc C1K52.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngayThi)) loi.ngayThi = "Chọn ngày thi.";
  if (hanDangKy && hanDangKy > ngayThi) loi.hanDangKy = "Hạn đăng ký phải trước ngày thi.";
  if (Object.keys(loi).length) return { ok: false, loi };

  if (id) await batBuocQuyenTrenDot(nd, id);

  const ts = {
    id: { kieu: sql.Int, gt: id },
    donVi: { kieu: sql.Int, gt: donViId },
    ma: { kieu: sql.VarChar(20), gt: maKhoa },
    ten: { kieu: sql.NVarChar(160), gt: ten || `Ghép khóa ${maKhoa}` },
    ngay: { kieu: sql.Date, gt: ngayThi },
    han: { kieu: sql.Date, gt: hanDangKy },
    sl: { kieu: sql.SmallInt, gt: soLuong },
    dd: { kieu: sql.NVarChar(200), gt: diaDiem },
    mo: { kieu: sql.Bit, gt: dangMo },
  };

  let dotIdThuc = id;
  try {
    if (id) {
      await truyVan(
        `UPDATE dbo.DotGhepKhoa
            SET MaKhoaDich=@ma, Ten=@ten, NgayThi=@ngay, HanDangKy=@han,
                SoLuongToiDa=@sl, DiaDiemThi=@dd, DangMo=@mo,
                TrangThai = CASE WHEN @mo = 1 THEN 'MO' ELSE 'DONG' END,
                CapNhatLuc = SYSDATETIMEOFFSET()
          WHERE DotId=@id`,
        ts,
      );
    } else {
      const hang = await truyVan<{ DotId: number }>(
        `INSERT dbo.DotGhepKhoa
           (DonViId, MaKhoaDich, KhoaDichId, Ten, NgayThi, HanDangKy, SoLuongToiDa, DiaDiemThi, DangMo, TrangThai)
         SELECT @donVi, @ma,
                (SELECT TOP 1 KhoaId FROM dbo.Khoa WHERE DonViId=@donVi AND MaKhoa=@ma),
                @ten, @ngay, @han, @sl, @dd, @mo,
                CASE WHEN @mo = 1 THEN 'MO' ELSE 'DONG' END;
         SELECT CAST(SCOPE_IDENTITY() AS int) AS DotId;`,
        ts,
      );
      dotIdThuc = hang[0]?.DotId ?? 0;
    }

    // Đồng bộ toàn bộ mã khóa đích (tag) — xóa hết rồi ghi lại cho đơn giản,
    // số lượng nhỏ (thường 1-5 mã) nên không cần so khớp tăng dần làm gì.
    if (dotIdThuc) {
      await truyVan(`DELETE FROM dbo.DotMaKhoaDich WHERE DotId = @dot`, {
        dot: { kieu: sql.Int, gt: dotIdThuc },
      });
      for (const m of dsMaKhoaHopLe) {
        await truyVan(
          `INSERT dbo.DotMaKhoaDich (DotId, MaKhoaDich) VALUES (@dot, @m)`,
          { dot: { kieu: sql.Int, gt: dotIdThuc }, m: { kieu: sql.VarChar(20), gt: m } },
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UQ_Dot_DonVi_Ma_Ngay"))
      return { ok: false, thongBao: "Đơn vị này đã có đợt cùng mã khóa và cùng ngày thi." };
    await ghiLoi(nd, id ? "SUA_DOT" : "TAO_DOT", "DotGhepKhoa", id || maKhoa, e);
    return { ok: false, thongBao: LOI_CHUNG };
  }

  await ghiNhatKy(nd, id ? "SUA_DOT" : "TAO_DOT", "DotGhepKhoa", id || maKhoa, `${maKhoa} — ${ten || maKhoa}`);
  revalidatePath("/admin/dot");
  revalidatePath("/");
  return { ok: true, thongBao: "Đã lưu đợt." };
}

export async function xoaDot(f: FormData) {
  const nd = await batBuoc();
  const id = Number(f.get("id"));
  await batBuocQuyenTrenDot(nd, id);
  const dot = await layDot(id);
  try {
    await truyVan(`DELETE FROM dbo.DotGhepKhoa WHERE DotId = @id`, {
      id: { kieu: sql.Int, gt: id },
    });
  } catch (e) {
    await ghiLoi(nd, "XOA_DOT", "DotGhepKhoa", id, e);
    revalidatePath("/admin/dot");
    return;
  }
  await ghiNhatKy(nd, "XOA_DOT", "DotGhepKhoa", id, dot ? `Xóa đợt ${dot.MaKhoaDich}` : "Xóa đợt");
  revalidatePath("/admin/dot");
  revalidatePath("/");
}

export async function doiTrangThai(f: FormData): Promise<void> {
  const nd = await batBuoc();
  const id = Number(f.get("id"));
  await batBuocQuyenTrenDangKy(nd, id);
  try {
    await goiThuTuc("dbo.sp_DuyetDangKy", {
      DangKyId: { kieu: sql.Int, gt: id },
      TrangThai: { kieu: sql.VarChar(12), gt: String(f.get("trangThai")) },
      NguoiDungId: { kieu: sql.Int, gt: nd.NguoiDungId },
      LyDo: { kieu: sql.NVarChar(300), gt: String(f.get("lyDo") ?? "").trim() || null },
    });
    // sp_DuyetDangKy tự ghi NhatKy rồi (xem sql/003_view_thutuc.sql) — chỉ
    // cần in ra terminal cho dev theo dõi, không ghi trùng vào DB nữa.
    console.log(
      `[${new Date().toISOString()}] ${nd.HoTen}#${nd.NguoiDungId} DOI_TRANG_THAI DangKyGhepKhoa#${id} — → ${String(f.get("trangThai"))}`,
    );
  } catch (e) {
    // Thao tác từ bảng danh sách không có chỗ hiện lỗi; ghi log rồi thôi,
    // trạng thái trên màn hình sẽ giữ nguyên nên cán bộ thấy ngay là chưa xong.
    await ghiLoi(nd, "DOI_TRANG_THAI", "DangKyGhepKhoa", id, loiNghiepVu(e) ?? e);
  }
  revalidatePath("/admin");
}

/* ------------------------------------------------- nhập bảng + đối chiếu tự động -- */

/**
 * Thêm một dòng vào đợt đang chọn rồi đối chiếu ngay với hồ sơ khóa cũ.
 *
 * Việc đối chiếu (đọc database GPLX hoặc file Báo cáo 1 trên share) nằm
 * ngoài khả năng của Node — gọi ra Python qua goiPython(). Script đó, khi
 * khớp được, tự upsert kết quả vào HocVien/Khoa/HocVienKhoa của chính
 * DrivingManagement, nên từ lần sau chỉ cần đọc lại DB, không phải gọi lại.
 */
export async function themDongNhap(_truoc: KetQua, f: FormData): Promise<KetQua> {
  const nd = await batBuoc();
  const { du, loi } = kiemTraDangKy(f);
  if (!du) return { ok: false, loi };

  await batBuocQuyenTrenDot(nd, du.dotId);
  const dot = await layDot(du.dotId);
  if (!dot) return { ok: false, thongBao: "Đợt không tồn tại." };

  // Khóa cũ trùng với chính mã khóa đích của đợt (ghép một khóa vào chính
  // nó) là vô lý — chặn ngay, khỏi phải đối chiếu.
  const trungKhoaDich = await motDong<{ n: number }>(
    `SELECT COUNT(*) AS n FROM dbo.DotMaKhoaDich WHERE DotId = @dot AND MaKhoaDich = @ma`,
    { dot: { kieu: sql.Int, gt: du.dotId }, ma: { kieu: sql.VarChar(20), gt: du.khoaGoc } },
  );
  if (trungKhoaDich && trungKhoaDich.n > 0) {
    return {
      ok: false,
      loi: { khoaGoc: `Khóa cũ "${du.khoaGoc}" trùng với mã khóa đích của đợt này — không được đăng ký.` },
    };
  }

  let dangKyId: number;
  try {
    const kq = await goiThuTuc(
      "dbo.sp_TaoDangKy",
      {
        DotId: { kieu: sql.Int, gt: du.dotId },
        HoTen: { kieu: sql.NVarChar(120), gt: du.hoTen },
        MaKhoaGoc: { kieu: sql.VarChar(20), gt: du.khoaGoc },
        NgaySinh: { kieu: sql.Date, gt: du.ngaySinh },
        Cccd: { kieu: sql.VarChar(12), gt: du.cccd },
        SoDienThoai: { kieu: sql.VarChar(15), gt: du.soDienThoai },
        DiaChi: { kieu: sql.NVarChar(400), gt: du.diaChi },
        GhiChu: { kieu: sql.NVarChar(300), gt: du.ghiChu },
        GiaoVien: { kieu: sql.NVarChar(120), gt: du.giaoVien },
      },
      { DangKyId: sql.Int },
    );
    dangKyId = Number(kq.ra.DangKyId);
  } catch (e) {
    const nv = loiNghiepVu(e);
    await ghiLoi(nd, "THEM_DANG_KY", "DangKyGhepKhoa", du.hoTen, nv ?? e);
    if (nv) return { ok: false, thongBao: nv };
    return { ok: false, thongBao: LOI_CHUNG };
  }

  const yeuCauNapMot = {
    dangKyId,
    hoTen: du.hoTen,
    ngaySinh: du.ngaySinh,
    maKhoaGoc: du.khoaGoc,
    maCoSo: dot.MaCoSo,
    ngayThi: ngayISO(dot.NgayThi),
  };
  const kqDb = await doiChieuMotHocVien(yeuCauNapMot);
  const chiTietNapMot: ChiTietGoi = {
    api: "db.ts -> doiChieuMotHocVien",
    yeuCau: yeuCauNapMot,
    phanHoi: kqDb,
  };

  revalidatePath("/admin");

  // Kiểm tra tình trạng hồ sơ khóa cũ trong dbo.HoSoHocVien để báo ngay học viên thiếu gì
  let thongBaoHoSo = "";
  try {
    const hs = await motDong<{
      TrangThaiHoSo: string;
      ChiTietThieu: string | null;
      GiayKhamTrangThai: string;
      DonHocTrangThai: string;
      HopDongTrangThai: string;
      BangKhaiTrangThai: string;
      CccdTrangThai: string;
    }>(
      `SELECT TOP 1 TrangThaiHoSo, ChiTietThieu, GiayKhamTrangThai, DonHocTrangThai, HopDongTrangThai, BangKhaiTrangThai, CccdTrangThai
         FROM dbo.HoSoHocVien
        WHERE DaXoa = 0
          AND MaKhoa = @maKhoa
          AND HoTen = @hoTen
        ORDER BY CASE WHEN Cccd = @cccd THEN 1 ELSE 2 END`,
      {
        maKhoa: { kieu: sql.VarChar, gt: du.khoaGoc.toUpperCase().trim() },
        hoTen: { kieu: sql.NVarChar, gt: du.hoTen },
        cccd: { kieu: sql.VarChar, gt: du.cccd ? du.cccd.trim() : null },
      },
    );

    if (hs) {
      if (hs.TrangThaiHoSo === "DU") {
        thongBaoHoSo = "Đủ hồ sơ";
      } else if (hs.TrangThaiHoSo === "THIEU") {
        thongBaoHoSo = `THIẾU: ${hs.ChiTietThieu || "chưa đủ giấy tờ"}`;
      } else {
        thongBaoHoSo = "Chưa kiểm tra hồ sơ khóa này";
      }
    }
  } catch (err) {
    console.error("Lỗi tra cứu HoSoHocVien:", err);
  }

  if (!kqDb.ok) {
    await ghiLoi(
      nd, "THEM_DANG_KY", "DangKyGhepKhoa", dangKyId,
      `${du.hoTen} — chưa đối chiếu được: ${kqDb.thongBao}`, chiTietNapMot,
    );
    return {
      ok: true,
      thongBao: `Đã thêm "${du.hoTen}" nhưng chưa đối chiếu được: ${kqDb.thongBao}`,
      thieuHoSo: thongBaoHoSo || undefined,
    };
  }
  await ghiNhatKy(
    nd, "THEM_DANG_KY", "DangKyGhepKhoa", dangKyId,
    `${kqDb.hoTen} (${kqDb.maKhoaGoc}) — đã khớp hồ sơ`, chiTietNapMot,
  );

  const tb = `Đã thêm và khớp hồ sơ: ${kqDb.hoTen} (${kqDb.maKhoaGoc}).`;
  return {
    ok: true,
    thongBao: tb,
    thieuHoSo: thongBaoHoSo || undefined,
  };
}
export type { GoiY } from "@/lib/db";
/**
 * Gợi ý tên + ngày sinh khớp một phần họ tên đang gõ, trong đúng khóa cũ đã
 * chọn — gọi từ NhapNhanh.tsx lúc người dùng gõ (có debounce ở client), để
 * thấy ngay ai trùng tên kèm ngày sinh phân biệt, không phải đợi bấm "Thêm"
 * rồi mới biết bị TRÙNG_TÊN.
 */
export async function goiYHocVien(dotId: number, hoTen: string, khoaGoc: string): Promise<GoiY[]> {
  const nd = await nguoiDangNhap();
  if (!nd) return [];
  if (hoTen.trim().length < 2) return [];

  // Không dùng batBuocQuyenTrenDot() ở đây — hàm đó redirect() khi sai
  // quyền, hợp lý cho một thao tác bấm nút nhưng phá luôn gợi ý ngầm đang
  // gõ (redirect() giữa lúc gõ sẽ điều hướng cả trang). Trả về rỗng thay vì.
  const pv = phamViDonVi(nd);
  const dot = await layDot(dotId);
  if (!dot || (pv !== undefined && dot.DonViId !== pv)) return [];

  const ma = chuanHoaMaKhoa(khoaGoc);
  // Nếu có gõ khóa gốc thì kiểm tra định dạng, không thì bỏ qua để tìm theo tên trên toàn bộ khóa
  if (ma && !/^[A-ZĐ0-9-]{1,14}K\d{1,4}$/.test(ma)) return [];

  const kqDb = await timHocVienKhoaCu(hoTen, dot.MaCoSo, 8);
  // Nếu có mã khóa gốc, lọc kết quả theo khóa gốc (trường hợp người dùng đã nhập mã khóa)
  return ma ? kqDb.filter(g => g.maKhoaGoc === ma) : kqDb;
}

/**
 * Đối chiếu lại một dòng chưa khớp — thường dùng khi lần đầu bị trùng tên và
 * cần bổ sung ngày sinh để phân biệt. Nếu có nhập ngày sinh mới thì lưu luôn
 * vào phiếu, để lần đối chiếu sau (hoặc lúc tra cứu) không phải nhập lại.
 */
export async function doiChieuLai(f: FormData) {
  const nd = await batBuoc();
  const id = Number(f.get("id"));
  await batBuocQuyenTrenDangKy(nd, id);

  const dangKy = await layDangKy(id);
  if (!dangKy) return;

  const ngaySinhMoi = chuanHoaNgay(String(f.get("ngaySinh") ?? "").trim());
  if (ngaySinhMoi) {
    await truyVan(`UPDATE dbo.DangKyGhepKhoa SET NgaySinhKhai=@ns WHERE DangKyId=@id`, {
      ns: { kieu: sql.Date, gt: ngaySinhMoi },
      id: { kieu: sql.Int, gt: id },
    });
  }

  const dot = await layDot(dangKy.DotId);
  if (!dot) return;

  const yeuCauNapMot = {
    dangKyId: id,
    hoTen: dangKy.HoTenKhai,
    ngaySinh: ngaySinhMoi ?? (dangKy.NgaySinhKhai ? ngayVN(dangKy.NgaySinhKhai) : null),
    maKhoaGoc: dangKy.MaKhoaGocKhai,
    maCoSo: dot.MaCoSo,
    ngayThi: ngayISO(dot.NgayThi),
  };
  const kqDb = await doiChieuMotHocVien(yeuCauNapMot);
  const chiTietNapMot: ChiTietGoi = {
    api: "db.ts -> doiChieuMotHocVien",
    yeuCau: yeuCauNapMot,
    phanHoi: kqDb,
  };
  if (kqDb.ok) {
    await ghiNhatKy(nd, "DOI_CHIEU_LAI", "DangKyGhepKhoa", id, `${dangKy.HoTenKhai} — đã khớp lại`, chiTietNapMot);
  } else {
    await ghiLoi(
      nd, "DOI_CHIEU_LAI", "DangKyGhepKhoa", id,
      `${dangKy.HoTenKhai} — vẫn chưa khớp: ${kqDb.thongBao}`, chiTietNapMot,
    );
  }

  revalidatePath("/admin");
}

export type KetQuaXuat = { ok: boolean; thongBao?: string; fileRa?: string };

/** Sinh file DS ghép khóa .xls chính thức từ những đăng ký đã duyệt của một đợt. */
export async function xuatFileGhepKhoa(_truoc: KetQuaXuat, f: FormData): Promise<KetQuaXuat> {
  const nd = await batBuoc();
  const dotId = Number(f.get("dotId"));
  await batBuocQuyenTrenDot(nd, dotId);

  const dot = await layDot(dotId);
  if (!dot) return { ok: false, thongBao: "Đợt không tồn tại." };

  const mau = await mauVanBanCuaDonVi(dot.DonViId);
  if (!mau) return { ok: false, thongBao: `Đơn vị ${dot.TenVietTat} chưa gán file mẫu (MauVanBan).` };

  const ds = (await dsDangKy({ dotId, donViId: phamViDonVi(nd) })).filter(
    (d) => d.TrangThai === "DUYET",
  );
  if (!ds.length) {
    return { ok: false, thongBao: "Đợt này chưa có đăng ký nào được duyệt." };
  }

  const rows = ds.map((d) => ({
    hoTen: d.HoTenHoSo ?? d.HoTenKhai,
    ngaySinh: ngayVN(d.NgaySinhHoSo ?? d.NgaySinhKhai),
    cccd: d.CccdHoSo ?? d.CccdKhai,
    diaChi: d.DiaChiHoSo ?? d.DiaChiKhai ?? "",
    hangGplx: d.HangGplxDaCo ?? "",
    soGplx: d.SoGplxDaCo ?? "",
    maHocVien: d.MaHocVien ?? "",
    maKhoaGoc: d.MaKhoaGocHoSo ?? d.MaKhoaGocKhai,
  }));

  // Excel COM có thể mất vài giây với danh sách dài — nới thời gian chờ.
  const kq = await goiPython<{ fileRa: string; soDong: number }>(
    "xuatweb",
    { maKhoaDich: dot.MaKhoaDich, ngayThi: ngayISO(dot.NgayThi), fileMau: mau, rows },
    180_000,
  );

  // Không đưa nguyên "rows" (danh sách đầy đủ họ tên/CCCD/địa chỉ) vào chi
  // tiết log — chỉ cần số dòng là đủ để dò lỗi, khỏi phình Nhật ký vô ích.
  const chiTietXuat: ChiTietGoi = {
    api: "python -m ghepkhoa xuatweb",
    yeuCau: { maKhoaDich: dot.MaKhoaDich, ngayThi: ngayISO(dot.NgayThi), fileMau: mau, soDong: rows.length },
    phanHoi: kq.ok ? kq.du : { loi: kq.loi },
  };

  if (!kq.ok) {
    await ghiLoi(nd, "XUAT_FILE", "DotGhepKhoa", dotId, `${dot.MaKhoaDich} — ${kq.loi}`, chiTietXuat);
    return { ok: false, thongBao: kq.loi };
  }
  await ghiNhatKy(
    nd, "XUAT_FILE", "DotGhepKhoa", dotId,
    `${dot.MaKhoaDich} — ${kq.du.soDong} thí sinh → ${kq.du.fileRa}`, chiTietXuat,
  );
  return {
    ok: true,
    thongBao: `Đã xuất ${kq.du.soDong} thí sinh ra file.`,
    fileRa: kq.du.fileRa,
  };
}

/* ------------------------------------------------------------------ hồ sơ -- */

const TRANG_THAI_HS = ["DU", "THIEU", "KHONG_CAN", "CHUA_KIEM"];

/** Lưu cả bảng đánh dấu hồ sơ của một đợt trong một lần gửi. */
export async function luuHoSo(f: FormData): Promise<void> {
  const nd = await batBuoc();
  const dotId = Number(f.get("dotId"));
  await batBuocQuyenTrenDot(nd, dotId);

  // Các ô hợp lệ của đợt này — tránh việc sửa URL/form để đụng sang đợt khác.
  const hopLe = new Set(
    (
      await truyVan<{ DangKyId: number }>(
        `SELECT DangKyId FROM dbo.DangKyGhepKhoa WHERE DotId = @dot`,
        { dot: { kieu: sql.Int, gt: dotId } },
      )
    ).map((r) => r.DangKyId),
  );

  const ds: { DangKyId: number; MucId: number; TrangThai: string; GhiChu: string | null }[] = [];

  // Nút "đánh dấu cả cột": value dạng "<mucId>:<trangThai>"
  const batTatCa = String(f.get("batTatCa") ?? "");
  if (batTatCa) {
    const [mucIdStr, tt] = batTatCa.split(":");
    const mucId = Number(mucIdStr);
    if (!Number.isInteger(mucId) || !TRANG_THAI_HS.includes(tt)) return;
    for (const id of hopLe) ds.push({ DangKyId: id, MucId: mucId, TrangThai: tt, GhiChu: null });
  } else {
    for (const [khoa, gt] of f.entries()) {
      const m = /^tt_(\d+)_(\d+)$/.exec(khoa);
      if (!m) continue;
      const dangKyId = Number(m[1]);
      const mucId = Number(m[2]);
      const tt = String(gt);
      if (!hopLe.has(dangKyId) || !TRANG_THAI_HS.includes(tt)) continue;
      ds.push({
        DangKyId: dangKyId,
        MucId: mucId,
        TrangThai: tt,
        GhiChu: String(f.get(`gc_${dangKyId}_${mucId}`) ?? "").trim() || null,
      });
    }
  }

  if (!ds.length) return;
  try {
    await goiThuTuc("dbo.sp_CapNhatHoSo", {
      Json: { kieu: sql.NVarChar(sql.MAX), gt: JSON.stringify(ds) },
      NguoiDungId: { kieu: sql.Int, gt: nd.NguoiDungId },
    });
    await ghiNhatKy(nd, "CAP_NHAT_HO_SO", "TinhTrangHoSo", dotId, `${ds.length} ô`);
  } catch (e) {
    await ghiLoi(nd, "CAP_NHAT_HO_SO", "TinhTrangHoSo", dotId, loiNghiepVu(e) ?? e);
  }
  revalidatePath("/admin/ho-so");
  revalidatePath("/admin");
}

export type KetQuaNap = {
  ok: boolean;
  thongBao?: string;
  soDong?: number;
  khongKhop?: { Dong: number; Cccd: string | null; HoTen: string; KhoaGoc: string | null }[];
};

/** Nạp DAT / học phí hàng loạt từ file CSV hoặc Excel. */
export async function napHoSo(_truoc: KetQuaNap, f: FormData): Promise<KetQuaNap> {
  const nd = await batBuoc();
  const dotId = Number(f.get("dotId"));
  const maMuc = String(f.get("maMuc") ?? "");
  const macDinh = String(f.get("trangThaiMacDinh") ?? "DU");
  const tep = f.get("tep");

  if (!Number.isInteger(dotId) || dotId <= 0) return { ok: false, thongBao: "Chưa chọn đợt." };
  if (!maMuc) return { ok: false, thongBao: "Chưa chọn mục cần nạp." };
  if (!(tep instanceof File) || tep.size === 0) return { ok: false, thongBao: "Chưa chọn file." };
  if (tep.size > 8 * 1024 * 1024) return { ok: false, thongBao: "File quá lớn (tối đa 8 MB)." };
  await batBuocQuyenTrenDot(nd, dotId);

  let hang: string[][];
  try {
    hang = await docBang(tep);
  } catch (e) {
    await ghiLoi(nd, "NAP_HO_SO_HANG_LOAT", "TinhTrangHoSo", dotId, `đọc file ${tep.name}: ${e}`);
    return { ok: false, thongBao: "Không đọc được file. Nhận .csv, .xlsx hoặc .xls." };
  }
  if (hang.length < 2) return { ok: false, thongBao: "File không có dòng dữ liệu nào." };

  const cot = doCotTieuDe(hang[0]);
  if (cot.hoTen < 0 && cot.cccd < 0) {
    return {
      ok: false,
      thongBao:
        "File phải có ít nhất một cột 'Họ và Tên' hoặc 'CCCD'. Các cột nhận thêm: 'Khóa', 'Trạng thái', 'Ghi chú'.",
    };
  }

  const lay = (h: string[], i: number) => (i >= 0 && i < h.length ? String(h[i] ?? "").trim() : "");
  const ds = hang
    .slice(1)
    .map((h) => ({
      Cccd: lay(h, cot.cccd).replace(/\D/g, ""),
      HoTen: chuanHoaTen(lay(h, cot.hoTen)),
      KhoaGoc: chuanHoaMaKhoa(lay(h, cot.khoa)),
      TrangThai: docTrangThai(lay(h, cot.trangThai), macDinh),
      GhiChu: lay(h, cot.ghiChu) || null,
    }))
    .filter((r) => r.Cccd || r.HoTen);

  if (!ds.length) return { ok: false, thongBao: "Không tìm thấy dòng nào có họ tên hoặc CCCD." };

  try {
    const kq = await goiThuTuc<{
      Dong: number;
      Cccd: string | null;
      HoTen: string;
      KhoaGoc: string | null;
    }>(
      "dbo.sp_NapHoSoHangLoat",
      {
        Json: { kieu: sql.NVarChar(sql.MAX), gt: JSON.stringify(ds) },
        DotId: { kieu: sql.Int, gt: dotId },
        MaMuc: { kieu: sql.VarChar(24), gt: maMuc },
        Nguon: { kieu: sql.VarChar(30), gt: maMuc === "DAT" ? "DAT" : maMuc === "HOC_PHI" ? "HOC_PHI" : "HO_SO" },
        MoTa: { kieu: sql.NVarChar(300), gt: `Nạp từ ${tep.name}` },
        NguoiDungId: { kieu: sql.Int, gt: nd.NguoiDungId },
      },
      { LanDongBoId: sql.Int },
    );
    revalidatePath("/admin/ho-so");
    revalidatePath("/admin");
    const khongKhop = kq.banGhi;
    await ghiNhatKy(
      nd, "NAP_HO_SO_HANG_LOAT", "TinhTrangHoSo", dotId,
      `${maMuc} từ ${tep.name} — ${ds.length - khongKhop.length}/${ds.length} dòng`,
    );
    return {
      ok: true,
      soDong: ds.length - khongKhop.length,
      khongKhop,
      thongBao: `Đã cập nhật ${ds.length - khongKhop.length}/${ds.length} dòng.`,
    };
  } catch (e) {
    const nv = loiNghiepVu(e);
    await ghiLoi(nd, "NAP_HO_SO_HANG_LOAT", "TinhTrangHoSo", dotId, nv ?? e);
    if (nv) return { ok: false, thongBao: nv };
    return { ok: false, thongBao: LOI_CHUNG };
  }
}

/** Đọc file thành mảng dòng × cột. Nhận CSV và cả hai đời Excel. */
async function docBang(tep: File): Promise<string[][]> {
  const ten = tep.name.toLowerCase();
  if (ten.endsWith(".csv") || tep.type === "text/csv") {
    const chu = new TextDecoder("utf-8").decode(await tep.arrayBuffer()).replace(/^﻿/, "");
    const dau = (chu.match(/;/g)?.length ?? 0) > (chu.match(/,/g)?.length ?? 0) ? ";" : ",";
    return chu
      .split(/\r?\n/)
      .filter((d) => d.trim())
      .map((d) => tachCsv(d, dau));
  }
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await tep.arrayBuffer());
  const ws = wb.worksheets[0];
  const ra: string[][] = [];
  ws.eachRow((r) => {
    const d: string[] = [];
    r.eachCell({ includeEmpty: true }, (c) => d.push(c.text ?? ""));
    ra.push(d);
  });
  return ra;
}

/** Tách một dòng CSV, hiểu dấu nháy kép bao quanh và nháy kép lồng ("") . */
function tachCsv(dong: string, dau: string): string[] {
  const ra: string[] = [];
  let o = "";
  let trongNhay = false;
  for (let i = 0; i < dong.length; i++) {
    const c = dong[i];
    if (trongNhay) {
      if (c === '"') {
        if (dong[i + 1] === '"') { o += '"'; i++; } else trongNhay = false;
      } else o += c;
    } else if (c === '"') trongNhay = true;
    else if (c === dau) { ra.push(o); o = ""; }
    else o += c;
  }
  ra.push(o);
  return ra;
}

function doCotTieuDe(hang: string[]) {
  const bo = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toUpperCase().trim();
  const tim = (...tu: string[]) =>
    hang.findIndex((h) => tu.some((t) => bo(h).includes(t)));
  return {
    hoTen: tim("HO VA TEN", "HOTEN", "HO TEN"),
    cccd: tim("CCCD", "CMND", "CAN CUOC"),
    khoa: tim("KHOA"),
    trangThai: tim("TRANG THAI", "KET QUA", "TINH TRANG"),
    ghiChu: tim("GHI CHU"),
  };
}

/** Ô trạng thái trong file có thể ghi đủ kiểu — quy về ba giá trị của lược đồ. */
function docTrangThai(o: string, macDinh: string): string {
  const s = o
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .trim();
  if (!s) return macDinh;
  if (["DU", "X", "CO", "ROI", "DA DONG", "DAT", "OK", "1", "TRUE"].includes(s)) return "DU";
  if (["THIEU", "CHUA", "CHUA DONG", "NO", "0", "FALSE"].includes(s)) return "THIEU";
  if (["KHONG CAN", "KHONG", "N/A", "-"].includes(s)) return "KHONG_CAN";
  return macDinh;
}

export async function xoaDangKy(f: FormData) {
  const nd = await batBuoc();
  const id = Number(f.get("id"));
  await batBuocQuyenTrenDangKy(nd, id);
  const dangKy = await layDangKy(id);
  try {
    await truyVan(`DELETE FROM dbo.DangKyGhepKhoa WHERE DangKyId = @id`, {
      id: { kieu: sql.Int, gt: id },
    });
    await ghiNhatKy(nd, "XOA", "DangKyGhepKhoa", id, dangKy ? `Xóa đăng ký ${dangKy.HoTenKhai}` : "Xóa đăng ký");
  } catch (e) {
    await ghiLoi(nd, "XOA", "DangKyGhepKhoa", id, e);
  }
  revalidatePath("/admin");
}

/* ------------------------------------------- QUẢN LÝ HỒ SƠ CÁC KHÓA (MỚI) -- */

function tinhTrangThaiHoSo(d: {
  CccdTrangThai: string;
  GiayKhamTrangThai: string;
  DonHocTrangThai: string;
  HopDongTrangThai: string;
  Hinh1MTrangThai: string;
  BangKhaiTrangThai: string;
}) {
  const thieu: string[] = [];
  if (d.CccdTrangThai === "THIEU") thieu.push("CCCD");
  if (d.GiayKhamTrangThai === "THIEU" || d.GiayKhamTrangThai === "CAN_KY") thieu.push("Giấy khám SK");
  if (d.DonHocTrangThai === "THIEU" || d.DonHocTrangThai === "CAN_KY") thieu.push("Đơn học");
  if (d.HopDongTrangThai === "THIEU") thieu.push("Hợp đồng");
  if (d.Hinh1MTrangThai === "THIEU") thieu.push("Ảnh 1M");
  if (d.BangKhaiTrangThai === "THIEU") thieu.push("Bản khai");

  if (thieu.length > 0) {
    return {
      trangThai: "THIEU" as const,
      chiTiet: `Thiếu: ${thieu.join(", ")}`,
    };
  }
  if (
    d.CccdTrangThai === "DU" &&
    d.GiayKhamTrangThai === "DU" &&
    (d.DonHocTrangThai === "DU" || d.DonHocTrangThai === "KHONG_CAN") &&
    (d.HopDongTrangThai === "DU" || d.HopDongTrangThai === "KHONG_CAN") &&
    (d.Hinh1MTrangThai === "DU" || d.Hinh1MTrangThai === "KHONG_CAN") &&
    (d.BangKhaiTrangThai === "DU" || d.BangKhaiTrangThai === "KHONG_CAN")
  ) {
    return {
      trangThai: "DU" as const,
      chiTiet: "Hồ sơ hoàn thiện đầy đủ",
    };
  }
  return {
    trangThai: "CHUA_KIEM" as const,
    chiTiet: "Chưa kiểm tra đầy đủ",
  };
}

const MAP_COT_MUC: Record<string, string> = {
  GiayKham: "GiayKhamTrangThai",
  DonHoc: "DonHocTrangThai",
  HopDong: "HopDongTrangThai",
  BangKhai: "BangKhaiTrangThai",
  Cccd: "CccdTrangThai",
  Hinh1M: "Hinh1MTrangThai",
  HocPhi: "HocPhiTrangThai",
};

/** Đổi nhanh trạng thái một mục hồ sơ + tính lại trạng thái tổng quát + ghi log */
export async function actionCapNhatMucHoSo(p: {
  hoSoId: number;
  muc: string;
  giaTriMoi: string;
  ghiChu?: string;
}): Promise<KetQua> {
  const nd = await batBuoc();
  const cot = MAP_COT_MUC[p.muc];
  if (!cot) return { ok: false, thongBao: "Mục hồ sơ không hợp lệ." };

  try {
    const hs = await motDong<any>(
      `SELECT * FROM dbo.HoSoHocVien WHERE HoSoId = @id AND DaXoa = 0`,
      { id: { kieu: sql.Int, gt: p.hoSoId } },
    );
    if (!hs) return { ok: false, thongBao: "Không tìm thấy hồ sơ học viên." };

    const giaTriCu = String(hs[cot] ?? "");
    if (giaTriCu === p.giaTriMoi) return { ok: true };

    const clone = { ...hs, [cot]: p.giaTriMoi };
    const { trangThai, chiTiet } = tinhTrangThaiHoSo(clone);

    await truyVan(
      `BEGIN TRAN;
         UPDATE dbo.HoSoHocVien
            SET ${cot} = @giaTriMoi,
                TrangThaiHoSo = @trangThai,
                ChiTietThieu = @chiTiet,
                CapNhatLuc = SYSDATETIMEOFFSET(),
                NguoiCapNhatId = @ndId
          WHERE HoSoId = @id;

         INSERT INTO dbo.LichSuHoSo (HoSoId, NguoiDungId, HanhDong, TruongThayDoi, GiaTriCu, GiaTriMoi, GhiChu)
         VALUES (@id, @ndId, 'DOI_TRANG_THAI', @muc, @giaTriCu, @giaTriMoi, @ghiChu);
       COMMIT TRAN;`,
      {
        id: { kieu: sql.Int, gt: p.hoSoId },
        giaTriMoi: { kieu: sql.VarChar, gt: p.giaTriMoi },
        trangThai: { kieu: sql.VarChar, gt: trangThai },
        chiTiet: { kieu: sql.NVarChar, gt: chiTiet },
        ndId: { kieu: sql.Int, gt: nd.NguoiDungId },
        muc: { kieu: sql.VarChar, gt: p.muc },
        giaTriCu: { kieu: sql.NVarChar, gt: giaTriCu },
        ghiChu: { kieu: sql.NVarChar, gt: p.ghiChu ?? null },
      },
    );

    revalidatePath("/admin/ho-so");
    return { ok: true };
  } catch (e: any) {
    console.error("actionCapNhatMucHoSo error:", e);
    return { ok: false, thongBao: e?.message ?? LOI_CHUNG };
  }
}

/** Thêm một hồ sơ học viên mới vào khóa */
export async function actionThemHoSo(f: {
  donViId: number;
  hangMa: string;
  maKhoa: string;
  hoTen: string;
  ngaySinh?: string;
  cccd?: string;
  soDienThoai?: string;
  diaChi?: string;
  giaoVien?: string;
  giayKhamTrangThai?: string;
  donHocTrangThai?: string;
  hopDongTrangThai?: string;
  bangKhaiTrangThai?: string;
  cccdTrangThai?: string;
  hinh1MTrangThai?: string;
  hocPhiTrangThai?: string;
  hocPhiSoTien?: number;
  ghiChu?: string;
}): Promise<KetQua> {
  const nd = await batBuoc();
  const hoTen = chuanHoaTen(f.hoTen);
  if (!hoTen) return { ok: false, thongBao: "Vui lòng nhập họ và tên học viên." };

  const cccdTrangThai = f.cccdTrangThai || (f.cccd ? "DU" : "CHUA_KIEM");
  const giayKhamTrangThai = f.giayKhamTrangThai || "CHUA_KIEM";
  const donHocTrangThai = f.donHocTrangThai || "DU";
  const hopDongTrangThai = f.hopDongTrangThai || "CHUA_KIEM";
  const hinh1MTrangThai = f.hinh1MTrangThai || "CHUA_KIEM";
  const bangKhaiTrangThai = f.bangKhaiTrangThai || "KHONG_CAN";

  const { trangThai, chiTiet } = tinhTrangThaiHoSo({
    CccdTrangThai: cccdTrangThai,
    GiayKhamTrangThai: giayKhamTrangThai,
    DonHocTrangThai: donHocTrangThai,
    HopDongTrangThai: hopDongTrangThai,
    Hinh1MTrangThai: hinh1MTrangThai,
    BangKhaiTrangThai: bangKhaiTrangThai,
  });

  try {
    const res = await motDong<{ HoSoId: number }>(
      `BEGIN TRAN;
         INSERT INTO dbo.HoSoHocVien (
           DonViId, HangMa, MaKhoa, HoTen, NgaySinh, Cccd, SoDienThoai, DiaChi, GiaoVien,
           GiayKhamTrangThai, DonHocTrangThai, HopDongTrangThai, BangKhaiTrangThai,
           CccdTrangThai, Hinh1MTrangThai, HocPhiTrangThai, HocPhiSoTien,
           TrangThaiHoSo, ChiTietThieu, GhiChu, NguoiCapNhatId
         ) VALUES (
           @donViId, @hangMa, @maKhoa, @hoTen, @ngaySinh, @cccd, @sdt, @diaChi, @gv,
           @gk, @don, @hd, @bk, @cc, @m1, @hp, @hpmoney,
           @trangThai, @chiTiet, @ghiChu, @ndId
         );
         DECLARE @newId int = SCOPE_IDENTITY();

         INSERT INTO dbo.LichSuHoSo (HoSoId, NguoiDungId, HanhDong, TruongThayDoi, GiaTriMoi, GhiChu)
         VALUES (@newId, @ndId, 'TAO_MOI', 'ToanBoHoSo', @trangThai, N'Thêm mới từ giao diện');

       COMMIT TRAN;
       SELECT @newId AS HoSoId;`,
      {
        donViId: { kieu: sql.Int, gt: f.donViId },
        hangMa: { kieu: sql.VarChar, gt: f.hangMa },
        maKhoa: { kieu: sql.VarChar, gt: f.maKhoa.toUpperCase().trim() },
        hoTen: { kieu: sql.NVarChar, gt: hoTen },
        ngaySinh: { kieu: sql.NVarChar, gt: f.ngaySinh ? f.ngaySinh.trim() : null },
        cccd: { kieu: sql.VarChar, gt: f.cccd ? f.cccd.trim() : null },
        sdt: { kieu: sql.VarChar, gt: f.soDienThoai ? f.soDienThoai.trim() : null },
        diaChi: { kieu: sql.NVarChar, gt: f.diaChi ? f.diaChi.trim() : null },
        gv: { kieu: sql.NVarChar, gt: f.giaoVien ? f.giaoVien.trim().toUpperCase() : null },
        gk: { kieu: sql.VarChar, gt: giayKhamTrangThai },
        don: { kieu: sql.VarChar, gt: donHocTrangThai },
        hd: { kieu: sql.VarChar, gt: hopDongTrangThai },
        bk: { kieu: sql.VarChar, gt: bangKhaiTrangThai },
        cc: { kieu: sql.VarChar, gt: cccdTrangThai },
        m1: { kieu: sql.VarChar, gt: hinh1MTrangThai },
        hp: { kieu: sql.VarChar, gt: f.hocPhiTrangThai || "CHUA_KIEM" },
        hpmoney: { kieu: sql.Int, gt: f.hocPhiSoTien || 0 },
        trangThai: { kieu: sql.VarChar, gt: trangThai },
        chiTiet: { kieu: sql.NVarChar, gt: chiTiet },
        ghiChu: { kieu: sql.NVarChar, gt: f.ghiChu ? f.ghiChu.trim() : null },
        ndId: { kieu: sql.Int, gt: nd.NguoiDungId },
      },
    );

    revalidatePath("/admin/ho-so");
    return { ok: true, thongBao: "Thêm hồ sơ học viên thành công." };
  } catch (e: any) {
    console.error("actionThemHoSo error:", e);
    return { ok: false, thongBao: e?.message ?? LOI_CHUNG };
  }
}

/** Chỉnh sửa thông tin học viên + ghi log chi tiết các trường thay đổi */
export async function actionSuaHoSo(
  hoSoId: number,
  f: {
    hoTen: string;
    ngaySinh?: string;
    cccd?: string;
    soDienThoai?: string;
    diaChi?: string;
    giaoVien?: string;
    maKhoa?: string;
    ghiChu?: string;
  },
): Promise<KetQua> {
  const nd = await batBuoc();
  const hoTen = chuanHoaTen(f.hoTen);
  if (!hoTen) return { ok: false, thongBao: "Vui lòng nhập họ và tên học viên." };

  try {
    const hs = await motDong<any>(
      `SELECT * FROM dbo.HoSoHocVien WHERE HoSoId = @id AND DaXoa = 0`,
      { id: { kieu: sql.Int, gt: hoSoId } },
    );
    if (!hs) return { ok: false, thongBao: "Không tìm thấy hồ sơ học viên." };

    const thayDoi: string[] = [];
    if (hs.HoTen !== hoTen) thayDoi.push(`Họ tên: '${hs.HoTen}' ➔ '${hoTen}'`);
    if ((hs.NgaySinh ?? "") !== (f.ngaySinh?.trim() ?? ""))
      thayDoi.push(`Ngày sinh: '${hs.NgaySinh ?? ""}' ➔ '${f.ngaySinh?.trim() ?? ""}'`);
    if ((hs.Cccd ?? "") !== (f.cccd?.trim() ?? ""))
      thayDoi.push(`CCCD: '${hs.Cccd ?? ""}' ➔ '${f.cccd?.trim() ?? ""}'`);
    if ((hs.SoDienThoai ?? "") !== (f.soDienThoai?.trim() ?? ""))
      thayDoi.push(`SĐT: '${hs.SoDienThoai ?? ""}' ➔ '${f.soDienThoai?.trim() ?? ""}'`);
    if ((hs.GiaoVien ?? "") !== (f.giaoVien?.trim().toUpperCase() ?? ""))
      thayDoi.push(`Giáo viên: '${hs.GiaoVien ?? ""}' ➔ '${f.giaoVien?.trim().toUpperCase() ?? ""}'`);
    if (f.maKhoa && hs.MaKhoa !== f.maKhoa.trim().toUpperCase())
      thayDoi.push(`Mã khóa: '${hs.MaKhoa}' ➔ '${f.maKhoa.trim().toUpperCase()}'`);

    const logNoiDung = thayDoi.length ? thayDoi.join("; ") : "Cập nhật thông tin";

    await truyVan(
      `BEGIN TRAN;
         UPDATE dbo.HoSoHocVien
            SET HoTen = @hoTen,
                NgaySinh = @ngaySinh,
                Cccd = @cccd,
                SoDienThoai = @sdt,
                DiaChi = @diaChi,
                GiaoVien = @gv,
                ${f.maKhoa ? "MaKhoa = @maKhoa," : ""}
                GhiChu = @ghiChu,
                CapNhatLuc = SYSDATETIMEOFFSET(),
                NguoiCapNhatId = @ndId
          WHERE HoSoId = @id;

         INSERT INTO dbo.LichSuHoSo (HoSoId, NguoiDungId, HanhDong, TruongThayDoi, GiaTriCu, GiaTriMoi, GhiChu)
         VALUES (@id, @ndId, 'SUA_THONG_TIN', 'ThongTinCaNhan', NULL, @noiDung, @ghiChu);
       COMMIT TRAN;`,
      {
        id: { kieu: sql.Int, gt: hoSoId },
        hoTen: { kieu: sql.NVarChar, gt: hoTen },
        ngaySinh: { kieu: sql.NVarChar, gt: f.ngaySinh ? f.ngaySinh.trim() : null },
        cccd: { kieu: sql.VarChar, gt: f.cccd ? f.cccd.trim() : null },
        sdt: { kieu: sql.VarChar, gt: f.soDienThoai ? f.soDienThoai.trim() : null },
        diaChi: { kieu: sql.NVarChar, gt: f.diaChi ? f.diaChi.trim() : null },
        gv: { kieu: sql.NVarChar, gt: f.giaoVien ? f.giaoVien.trim().toUpperCase() : null },
        maKhoa: { kieu: sql.VarChar, gt: f.maKhoa ? f.maKhoa.trim().toUpperCase() : null },
        ghiChu: { kieu: sql.NVarChar, gt: f.ghiChu ? f.ghiChu.trim() : null },
        ndId: { kieu: sql.Int, gt: nd.NguoiDungId },
        noiDung: { kieu: sql.NVarChar, gt: logNoiDung },
      },
    );

    revalidatePath("/admin/ho-so");
    return { ok: true, thongBao: "Cập nhật thông tin thành công." };
  } catch (e: any) {
    console.error("actionSuaHoSo error:", e);
    return { ok: false, thongBao: e?.message ?? LOI_CHUNG };
  }
}

/** Xóa mềm hồ sơ học viên (DaXoa = 1) */
export async function actionXoaHoSo(hoSoId: number, lyDo?: string): Promise<KetQua> {
  const nd = await batBuoc();
  try {
    const hs = await motDong<any>(
      `SELECT HoTen, MaKhoa FROM dbo.HoSoHocVien WHERE HoSoId = @id`,
      { id: { kieu: sql.Int, gt: hoSoId } },
    );
    if (!hs) return { ok: false, thongBao: "Không tìm thấy hồ sơ học viên." };

    await truyVan(
      `BEGIN TRAN;
         UPDATE dbo.HoSoHocVien
            SET DaXoa = 1,
                CapNhatLuc = SYSDATETIMEOFFSET(),
                NguoiCapNhatId = @ndId
          WHERE HoSoId = @id;

         INSERT INTO dbo.LichSuHoSo (HoSoId, NguoiDungId, HanhDong, TruongThayDoi, GiaTriCu, GiaTriMoi, GhiChu)
         VALUES (@id, @ndId, 'XOA', 'DaXoa', '0', '1', @lyDo);
       COMMIT TRAN;`,
      {
        id: { kieu: sql.Int, gt: hoSoId },
        ndId: { kieu: sql.Int, gt: nd.NguoiDungId },
        lyDo: { kieu: sql.NVarChar, gt: lyDo ? lyDo.trim() : "Xóa từ giao diện quản trị" },
      },
    );

    revalidatePath("/admin/ho-so");
    return { ok: true, thongBao: "Đã xóa hồ sơ học viên." };
  } catch (e: any) {
    console.error("actionXoaHoSo error:", e);
    return { ok: false, thongBao: e?.message ?? LOI_CHUNG };
  }
}

/** Lấy lịch sử cập nhật chi tiết của một hồ sơ */
export async function actionLayLichSuHoSo(hoSoId: number) {
  await batBuoc();
  const { chiTietLichSuHoSo } = await import("@/lib/db");
  return chiTietLichSuHoSo(hoSoId);
}

