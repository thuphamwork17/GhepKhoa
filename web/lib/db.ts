import { motDong, sql, truyVan, truyVanTrungTam, truyVanTruong, pool } from "./sql";
import { chuanHoaMaKhoa, ngayISO } from "./kiemtra";

/* ------------------------------------------------------------------ kiểu -- */

export type DonVi = {
  DonViId: number;
  MaCoSo: string;
  LoaiDonVi: "TRUONG" | "TRUNG_TAM";
  TenDayDu: string;
  TenVietTat: string;
  ChucDanhKy: string | null;
  NguoiKy: string | null;
  DangHoatDong: boolean;
};

export type Dot = {
  DotId: number;
  DonViId: number;
  MaCoSo: string;
  TenVietTat: string;
  TenDonVi: string;
  LoaiDonVi: "TRUONG" | "TRUNG_TAM";
  MaKhoaDich: string;
  Ten: string;
  NgayThi: Date;
  HanDangKy: Date | null;
  SoLuongToiDa: number | null;
  DiaDiemThi: string | null;
  DangMo: boolean;
  TrangThai: string;
  SoDangKy: number;
  SoDaDuyet: number;
  SoChoDuyet: number;
  SoTuChoi: number;
  ConLai: number | null;
  ConNhanDangKy: boolean;
};

export type DangKy = {
  DangKyId: number;
  DotId: number;
  DonViId: number;
  TenVietTat: string;
  MaKhoaDich: string;
  NgayThi: Date;
  TenDot: string;
  HoTenKhai: string;
  NgaySinhKhai: Date;
  CccdKhai: string;
  DiaChiKhai: string | null;
  MaKhoaGocKhai: string;
  SoDienThoai: string;
  GhiChuKhai: string | null;
  GiaoVien: string | null;
  TrangThai: "CHO_DUYET" | "DUYET" | "TU_CHOI";
  LyDoTuChoi: string | null;
  CachKhop: "CCCD" | "TEN_NGAYSINH" | "THU_CONG" | null;
  HocVienKhoaId: number | null;
  TaoLuc: Date;
  DuyetLuc: Date | null;
  NguoiDuyet: string | null;
  HoTenHoSo: string | null;
  NgaySinhHoSo: Date | null;
  CccdHoSo: string | null;
  DiaChiHoSo: string | null;
  SoGplxDaCo: string | null;
  HangGplxDaCo: string | null;
  MaHocVien: string | null;
  MaKhoaGocHoSo: string | null;
  KetQuaKhoaGoc: string | null;
  LechCccd: boolean;
  LechKhoa: boolean;
  TrangThaiHoSo?: string | null;
  ChiTietThieu?: string | null;
};

/* ----------------------------------------------------------------- đơn vị -- */

export function dsDonVi(chiHoatDong = true) {
  return truyVan<DonVi>(
    `SELECT DonViId, MaCoSo, LoaiDonVi, TenDayDu, TenVietTat, ChucDanhKy, NguoiKy, DangHoatDong
       FROM dbo.DonVi
      ${chiHoatDong ? "WHERE DangHoatDong = 1" : ""}
      ORDER BY LoaiDonVi DESC, TenDayDu`,
  );
}

export function layDonVi(id: number) {
  return motDong<DonVi>(
    `SELECT DonViId, MaCoSo, LoaiDonVi, TenDayDu, TenVietTat, ChucDanhKy, NguoiKy, DangHoatDong
       FROM dbo.DonVi WHERE DonViId = @id`,
    { id: { kieu: sql.Int, gt: id } },
  );
}

/* -------------------------------------------------------------------- đợt -- */

/** @param donViId giới hạn theo đơn vị; bỏ trống = tất cả (chỉ dành cho quản trị). */
export function dsDot(
  opt: {
    chiConNhan?: boolean;
    donViId?: number;
    tuNgay?: string; // yyyy-mm-dd, tính cả ngày này
    denNgay?: string; // yyyy-mm-dd, tính cả ngày này
  } = {},
) {
  const dk: string[] = [];
  const ts: Record<string, { kieu: unknown; gt: unknown }> = {};
  if (opt.chiConNhan) dk.push("ConNhanDangKy = 1");
  if (opt.donViId) {
    dk.push("DonViId = @donVi");
    ts.donVi = { kieu: sql.Int, gt: opt.donViId };
  }
  if (opt.tuNgay) {
    dk.push("NgayThi >= @tuNgay");
    ts.tuNgay = { kieu: sql.Date, gt: opt.tuNgay };
  }
  if (opt.denNgay) {
    dk.push("NgayThi <= @denNgay");
    ts.denNgay = { kieu: sql.Date, gt: opt.denNgay };
  }
  return truyVan<Dot>(
    `SELECT * FROM dbo.vw_Dot
      ${dk.length ? "WHERE " + dk.join(" AND ") : ""}
      ORDER BY NgayThi, TenVietTat, MaKhoaDich`,
    ts as Parameters<typeof truyVan>[1],
  );
}

export function layDot(id: number) {
  return motDong<Dot>(`SELECT * FROM dbo.vw_Dot WHERE DotId = @id`, {
    id: { kieu: sql.Int, gt: id },
  });
}

/* ---------------------------------------------------------------- đăng ký -- */

export function dsDangKy(opt: { dotId?: number; donViId?: number } = {}) {
  const dk: string[] = [];
  if (opt.dotId) dk.push("DotId = @dot");
  if (opt.donViId) dk.push("DonViId = @donVi");
  const ts: Record<string, { kieu: typeof sql.Int; gt: number }> = {};
  if (opt.dotId) ts.dot = { kieu: sql.Int, gt: opt.dotId };
  if (opt.donViId) ts.donVi = { kieu: sql.Int, gt: opt.donViId };

  // Thứ tự giống hệt danh sách in ra: nhóm theo hạng rồi số khóa, trong nhóm
  // xếp theo tên riêng (xem chú thích ở sql/004_sap_xep_ten.sql).
  return truyVan<DangKy>(
    `SELECT * FROM dbo.vw_DangKySapXep
      ${dk.length ? "WHERE " + dk.join(" AND ") : ""}
      ORDER BY NgayThi, ThuTuHang, SoKhoaGoc, SapXep1, SapXep2, SapXep3, SapXep4`,
    ts,
  );
}

export function layDangKy(id: number) {
  return motDong<DangKy>(`SELECT * FROM dbo.vw_DangKy WHERE DangKyId = @id`, {
    id: { kieu: sql.Int, gt: id },
  });
}

/** Đường dẫn tuyệt đối tới file mẫu .xls của một đơn vị (cột DonVi.MauVanBan
 *  lưu đường dẫn tương đối gốc D:GhepKhoa, ví dụ 'MauDS ghép khóa...xls'). */
export async function mauVanBanCuaDonVi(donViId: number): Promise<string | null> {
  const r = await motDong<{ MauVanBan: string | null }>(
    `SELECT MauVanBan FROM dbo.DonVi WHERE DonViId = @id`,
    { id: { kieu: sql.Int, gt: donViId } },
  );
  if (!r?.MauVanBan) return null;
  return `D:\\GhepKhoa\\${r.MauVanBan}`;
}

/* ------------------------------------------------------------- hồ sơ -- */

export type MucHoSo = {
  DangKyId: number;
  MucId: number;
  MaMuc: string;
  TenMuc: string;
  MoTaChoHocVien: string | null;
  ThuTu: number;
  TrangThai: "DU" | "THIEU" | "KHONG_CAN" | "CHUA_KIEM";
  GhiChu: string | null;
  DuLieuTinhDen: Date | null;
  NguonDuLieu: string | null;
};

export function hoSoTungMuc(dangKyIds: number[]) {
  if (!dangKyIds.length) return Promise.resolve([] as MucHoSo[]);
  // Danh sách id do server tự dựng từ kết quả truy vấn trước, không phải
  // dữ liệu người dùng gõ vào; vẫn ép sang số nguyên cho chắc.
  const ds = dangKyIds.map((n) => Math.trunc(Number(n))).filter(Number.isFinite);
  return truyVan<MucHoSo>(
    `SELECT DangKyId, MucId, MaMuc, TenMuc, MoTaChoHocVien, ThuTu, TrangThai, GhiChu,
            DuLieuTinhDen, NguonDuLieu
       FROM dbo.vw_HoSoTungMuc
      WHERE DangKyId IN (${ds.join(",")})
      ORDER BY DangKyId, ThuTu`,
  );
}

export type TomTatHoSo = {
  DangKyId: number;
  SoMucCanCo: number;
  SoDu: number;
  SoThieu: number;
  SoChuaKiem: number;
  TenMucThieu: string | null;
  DuLieuTinhDen: Date | null;
};

export function hoSoTomTat(dangKyIds: number[]) {
  if (!dangKyIds.length) return Promise.resolve([] as TomTatHoSo[]);
  const ds = dangKyIds.map((n) => Math.trunc(Number(n))).filter(Number.isFinite);
  return truyVan<TomTatHoSo>(
    `SELECT * FROM dbo.vw_HoSoTomTat WHERE DangKyId IN (${ds.join(",")})`,
  );
}

export type DongBo = { Nguon: string; ThoiDiem: Date; MoTa: string | null; SoBanGhi: number | null };

export function dongBoGanNhat() {
  return truyVan<DongBo>(`SELECT * FROM dbo.vw_DongBoGanNhat ORDER BY Nguon`);
}

export type MucKiemTra = {
  MucId: number;
  Ma: string;
  Ten: string;
  Nguon: string;
  ThuTu: number;
  ChiKhiNangHang: boolean;
};

export function dsMucKiemTra() {
  return truyVan<MucKiemTra>(
    `SELECT MucId, Ma, Ten, Nguon, ThuTu, ChiKhiNangHang
       FROM dbo.MucKiemTra WHERE DangSuDung = 1 ORDER BY ThuTu`,
  );
}

/* -------------------------------------------------------------- nhật ký -- */

export type NhatKy = {
  NhatKyId: number;
  ThoiDiem: Date;
  NguoiDungId: number | null;
  NguoiDung: string | null;
  TenVietTat: string | null;
  HanhDong: string;
  Bang: string;
  KhoaChinh: string | null;
  NoiDung: string | null;
};

/** Ai làm gì lúc nào — dùng cho trang /admin/log.
 *  donViId có giá trị thì chỉ thấy nhật ký của người thuộc đơn vị đó (cán bộ
 *  đơn vị không cần/không nên thấy thao tác của đơn vị kia); để trống thì
 *  thấy hết (quản trị toàn hệ thống).                                       */
export function dsNhatKy(opt: { donViId?: number; gioiHan?: number } = {}) {
  const gioiHan = Math.min(Math.max(opt.gioiHan ?? 300, 1), 1000);
  return truyVan<NhatKy>(
    `SELECT TOP (${gioiHan}) nk.NhatKyId, nk.ThoiDiem, nk.NguoiDungId,
            nd.HoTen AS NguoiDung, dv.TenVietTat,
            nk.HanhDong, nk.Bang, nk.KhoaChinh, nk.NoiDung
       FROM dbo.NhatKy nk
       LEFT JOIN dbo.NguoiDung nd ON nd.NguoiDungId = nk.NguoiDungId
       LEFT JOIN dbo.DonVi dv     ON dv.DonViId     = nd.DonViId
       ${opt.donViId ? "WHERE nd.DonViId = @donVi" : ""}
      ORDER BY nk.ThoiDiem DESC`,
    opt.donViId ? { donVi: { kieu: sql.Int, gt: opt.donViId } } : {},
  );
}

/* -------------------------------------------------------- hồ sơ khóa cũ -- */

export type HoSoHocVien = {
  HoSoId: number;
  DonViId: number;
  HangMa: string;
  MaKhoa: string;
  KhoaId: number | null;
  HoTen: string;
  NgaySinh: string | null;
  Cccd: string | null;
  SoDienThoai: string | null;
  DiaChi: string | null;
  GiaoVien: string | null;
  MaHocVien: string | null;
  SoHoSo: string | null;
  SoHopDong: string | null;
  HocPhiSoTien: number;
  HocPhiTrangThai: string;
  CccdTrangThai: string;
  GiayKhamTrangThai: string;
  DonHocTrangThai: string;
  HopDongTrangThai: string;
  Hinh1MTrangThai: string;
  BangKhaiTrangThai: string;
  DatTrangThai: string;
  TrangThaiHoSo: string;
  ChiTietThieu: string | null;
  GhiChu: string | null;
  FileNguon: string | null;
  DaXoa: boolean;
  TaoLuc: Date;
  CapNhatLuc: Date;
  NguoiCapNhatId: number | null;
  MaKhoaDich?: string | null;
  NgayThiDich?: Date | null;
};

export type LichSuHoSoItem = {
  LichSuId: number;
  HoSoId: number;
  ThoiDiem: Date;
  NguoiDungId: number | null;
  HanhDong: string;
  TruongThayDoi: string | null;
  GiaTriCu: string | null;
  GiaTriMoi: string | null;
  GhiChu: string | null;
  NguoiDung: string;
};

export async function dsKhoaHoSo(opt: { donViId?: number | null } = {}) {
  const ts: any = {};
  let where = "WHERE DaXoa = 0";
  if (opt.donViId) {
    where += " AND DonViId = @dv";
    ts.dv = { kieu: sql.Int, gt: opt.donViId };
  }
  const res = await truyVan<{ MaKhoa: string }>(
    `SELECT DISTINCT MaKhoa FROM dbo.HoSoHocVien ${where} ORDER BY MaKhoa DESC`,
    ts
  );
  return res.map((r) => r.MaKhoa);
}

export async function dsGiaoVienHoSo(opt: { donViId?: number | null; maKhoa?: string } = {}) {
  const ts: any = {};
  let where = "WHERE DaXoa = 0 AND GiaoVien IS NOT NULL AND GiaoVien != ''";
  if (opt.donViId) {
    where += " AND DonViId = @dv";
    ts.dv = { kieu: sql.Int, gt: opt.donViId };
  }
  if (opt.maKhoa) {
    where += " AND MaKhoa = @mk";
    ts.mk = { kieu: sql.VarChar, gt: opt.maKhoa };
  }
  const res = await truyVan<{ GiaoVien: string }>(
    `SELECT DISTINCT GiaoVien FROM dbo.HoSoHocVien ${where} ORDER BY GiaoVien ASC`,
    ts
  );
  return res.map((r) => r.GiaoVien);
}

export async function thongKeHoSo(opt: { donViId?: number | null; maKhoa?: string } = {}) {
  const ts: any = {};
  let where = "WHERE DaXoa = 0";
  if (opt.donViId) {
    where += " AND DonViId = @dv";
    ts.dv = { kieu: sql.Int, gt: opt.donViId };
  }
  if (opt.maKhoa) {
    where += " AND MaKhoa = @mk";
    ts.mk = { kieu: sql.VarChar, gt: opt.maKhoa };
  }

  const res = await motDong<{
    Tong: number;
    SoDu: number;
    SoThieu: number;
    SoChuaKiem: number;
  }>(
    `SELECT 
      COUNT(*) AS Tong,
      ISNULL(SUM(CASE WHEN TrangThaiHoSo = 'DU' THEN 1 ELSE 0 END), 0) AS SoDu,
      ISNULL(SUM(CASE WHEN TrangThaiHoSo = 'THIEU' THEN 1 ELSE 0 END), 0) AS SoThieu,
      ISNULL(SUM(CASE WHEN TrangThaiHoSo = 'CHUA_KIEM' THEN 1 ELSE 0 END), 0) AS SoChuaKiem
    FROM dbo.HoSoHocVien ${where}`,
    ts
  );

  return res || { Tong: 0, SoDu: 0, SoThieu: 0, SoChuaKiem: 0 };
}

export type ThongKeKhoa = {
  MaKhoa: string;
  HangMa: string;
  TongSo: number;
  SoDu: number;
  SoThieu: number;
  SoChuaKiem: number;
};

export async function thongKeCacKhoa(opt: { donViId?: number | null } = {}) {
  const qGPLX = `SELECT MaKH AS MaKhoa, HangGPLX AS HangMa, ISNULL(TongSoHV, 0) AS TongSoGPLX FROM dbo.KhoaHoc WHERE YEAR(NgayBG) >= YEAR(GETDATE()) AND HangGPLX NOT IN ('A1', 'A01', 'A02')`;

  const [khoaTruong, khoaTrungTam, statsWeb] = await Promise.all([
    truyVanTruong<{ MaKhoa: string; HangMa: string; TongSoGPLX: number }>(qGPLX),
    truyVanTrungTam<{ MaKhoa: string; HangMa: string; TongSoGPLX: number }>(qGPLX),
    truyVan<{
      MaKhoa: string;
      SoDu: number;
      SoThieu: number;
      SoChuaKiem: number;
    }>(`
      SELECT 
        MaKhoa,
        SUM(CASE WHEN TrangThaiHoSo = 'DU' THEN 1 ELSE 0 END) AS SoDu,
        SUM(CASE WHEN TrangThaiHoSo = 'THIEU' THEN 1 ELSE 0 END) AS SoThieu,
        SUM(CASE WHEN TrangThaiHoSo = 'CHUA_KIEM' THEN 1 ELSE 0 END) AS SoChuaKiem
      FROM dbo.HoSoHocVien
      WHERE DaXoa = 0
      GROUP BY MaKhoa
    `),
  ]);

  const mapKhoa = new Map<string, ThongKeKhoa>();

  const addKhoa = (k: { MaKhoa: string; HangMa: string; TongSoGPLX: number }) => {
    if (!mapKhoa.has(k.MaKhoa)) {
      mapKhoa.set(k.MaKhoa, {
        MaKhoa: k.MaKhoa,
        HangMa: k.HangMa,
        TongSo: k.TongSoGPLX,
        SoDu: 0,
        SoThieu: 0,
        SoChuaKiem: k.TongSoGPLX, // Mặc định tất cả là CHUA_KIEM nếu chưa có trong Web
      });
    }
  };

  khoaTruong.forEach(addKhoa);
  khoaTrungTam.forEach(addKhoa);

  for (const s of statsWeb) {
    const k = mapKhoa.get(s.MaKhoa);
    if (k) {
      k.SoDu = s.SoDu;
      k.SoThieu = s.SoThieu;
      // Số chưa kiểm thực tế = Tổng học viên gốc - số đã kiểm (Đủ + Thiếu)
      // Nhưng nếu TongSoGPLX sai lệch so với thực tế thì sao? Tốt nhất là dùng SoChuaKiem từ Web + phần chênh lệch
      const soDaCoHSo = s.SoDu + s.SoThieu + s.SoChuaKiem;
      const soChuaDongBo = Math.max(0, k.TongSo - soDaCoHSo);
      k.SoChuaKiem = s.SoChuaKiem + soChuaDongBo;
    }
  }

  return Array.from(mapKhoa.values()).sort((a, b) => b.MaKhoa.localeCompare(a.MaKhoa));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const res = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

function xuLyNgaySinh(ns: string | null | undefined): string | null {
  if (!ns) return null;
  const s = ns.trim();
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (s.length === 4) return `${s}-01-01`;
  if (s.length === 10) return s; // yyyy-mm-dd
  return null;
}

async function dongBoKhoaGPLX(maKhoa: string) {
  const isTrungTam = maKhoa.startsWith("92004");
  const isTruong = maKhoa.startsWith("92001");
  if (!isTrungTam && !isTruong) return;

  const donViId = isTrungTam ? 2 : 1;
  const truyVanFn = isTrungTam ? truyVanTrungTam : truyVanTruong;
  const motDongFn = isTrungTam ? (q: string, ts: any) => truyVanTrungTam(q, ts).then((r) => r[0]) : (q: string, ts: any) => truyVanTruong(q, ts).then((r) => r[0]);

  const khoa = await motDongFn(
    `SELECT HangGPLX FROM dbo.KhoaHoc WHERE MaKH = @mk`,
    { mk: { kieu: sql.VarChar, gt: maKhoa } }
  ) as { HangGPLX: string } | undefined;

  if (!khoa) return;
  const hangMa = khoa.HangGPLX || "";

  const qStudents = `
    SELECT 
      n.SoCMT AS Cccd, 
      n.HoVaTen AS HoTen, 
      n.NgaySinh, 
      n.NoiCT AS DiaChi
    FROM dbo.NguoiLX_HoSo h
    JOIN dbo.NguoiLX n ON h.MaDK = n.MaDK
    WHERE h.MaKhoaHoc = @mk
  `;
  const students = await truyVanFn<{ Cccd: string; HoTen: string; NgaySinh: string; DiaChi: string }>(
    qStudents, 
    { mk: { kieu: sql.VarChar, gt: maKhoa } }
  );

  if (students.length === 0) return;

  const p = await pool();
  for (const chunk of chunkArray(students, 200)) {
    const r = p.request();
    r.input("dv", sql.Int, donViId);
    r.input("hang", sql.VarChar, hangMa);
    r.input("mk", sql.VarChar, maKhoa);

    let valuesStr = "";
    chunk.forEach((st, i) => {
      r.input(`cccd${i}`, sql.VarChar, (st.Cccd || "").trim());
      r.input(`ten${i}`, sql.NVarChar, (st.HoTen || "").trim());
      r.input(`ns${i}`, sql.Date, xuLyNgaySinh(st.NgaySinh));
      r.input(`dc${i}`, sql.NVarChar, (st.DiaChi || "").trim());
      if (i > 0) valuesStr += ", ";
      valuesStr += `(@cccd${i}, @ten${i}, @ns${i}, @dc${i})`;
    });

    const mergeSql = `
      MERGE dbo.HoSoHocVien AS t
      USING (VALUES ${valuesStr}) AS n (Cccd, HoTen, NgaySinh, DiaChi)
        ON t.Cccd = n.Cccd AND t.MaKhoa = @mk
      WHEN NOT MATCHED THEN 
        INSERT (DonViId, HangMa, MaKhoa, HoTen, NgaySinh, Cccd, DiaChi, TrangThaiHoSo)
        VALUES (@dv, @hang, @mk, n.HoTen, n.NgaySinh, n.Cccd, n.DiaChi, 'CHUA_KIEM');
    `;
    await r.query(mergeSql);
  }
}

function maKhoaTuTenKH(tenKH: string): string {
  if (!tenKH) return "";
  const match = tenKH.match(/^\s*([A-Za-zĐđ()0-9\-\.\>]+)\s*K(?:HÓA|HOÁ)?\s*(\d+)/i);
  if (match) {
    const ma = `${match[1]}K${match[2]}`.toUpperCase().replace(/Đ/g, 'D');
    return chuanHoaMaKhoa(ma);
  }
  return "";
}

export type GoiY = { hoTen: string; ngaySinh: string; maKhoaGoc: string; cccd: string; diaChi?: string; hangGplx?: string; soGplx?: string; maHocVien?: string; ngayBeGiang?: string };

export async function timHocVienKhoaCu(motPhanTen: string, maCoSo: string, gioiHan: number = 10): Promise<GoiY[]> {
  if (!motPhanTen || motPhanTen.trim().length < 2) return [];

  const q = `
    SET NOCOUNT ON;
    SELECT TOP ${gioiHan} HoVaTen,
      NgaySinh,
      Cccd,
      TenKH
    FROM dbo.Sync_HocVien
    WHERE MaCoSo = @maCS
      AND HoVaTen COLLATE Latin1_General_CI_AI LIKE @mau COLLATE Latin1_General_CI_AI
    ORDER BY NgayDongBo DESC;
  `;
  const mau = `%${motPhanTen.replace(/ /g, '%')}%`;
  const thamSo = { 
    mau: { kieu: sql.NVarChar, gt: mau },
    maCS: { kieu: sql.VarChar, gt: maCoSo }
  };

  try {
    const rs = await truyVan<{HoVaTen: string; NgaySinh: string; Cccd: string; TenKH: string}>(q, thamSo);
    return rs.map(r => {
      // Fix format NgaySinh from yyyymmdd to dd/mm/yyyy if needed
      let ns = r.NgaySinh ? r.NgaySinh.trim() : "";
      if (ns && ns.length === 8 && !ns.includes("/")) {
        ns = `${ns.substring(6,8)}/${ns.substring(4,6)}/${ns.substring(0,4)}`;
      }
      return {
        hoTen: r.HoVaTen ? r.HoVaTen.trim() : "",
        ngaySinh: ns,
        cccd: r.Cccd ? r.Cccd.trim() : "",
        maKhoaGoc: r.TenKH ? maKhoaTuTenKH(r.TenKH) : ""
      };
    }).filter(x => x.maKhoaGoc !== "");
  } catch(e) {
    console.error("Lỗi timHocVienKhoaCu Sync_HocVien:", e);
    return [];
  }
}

export async function doiChieuMotHocVien(vao: {
  dangKyId: number;
  hoTen: string;
  ngaySinh: string | null;
  maKhoaGoc: string;
  maCoSo: string;
  ngayThi: string | null;
}): Promise<{ ok: boolean; ma?: string; thongBao?: string; cach?: string; hoTen?: string; ngaySinh?: string; cccd?: string; diaChi?: string; hangGplx?: string; soGplx?: string; maHocVien?: string; maKhoaGoc?: string; candidates?: any[] }> {
  const { dangKyId, hoTen, ngaySinh, maKhoaGoc, maCoSo, ngayThi } = vao;
  const hoTenCan = hoTen.normalize("NFC").replace(/s+/g, " ").trim().toUpperCase();

  if (!hoTenCan || !maKhoaGoc || !["92001", "92004"].includes(maCoSo)) {
    return { ok: false, ma: "THIEU_DU_LIEU", thongBao: "Thiếu họ tên, mã khóa hoặc mã cơ sở." };
  }

  // 1. Fetch entire course from appropriate DB to match exactly how python _nap_ds_khoa worked
  const match = maKhoaGoc.match(/^([A-ZĐ0-9-]+)K(\d+)$/);
  if (!match) return { ok: false, ma: "LOI", thongBao: `Không tách được mã khóa '${maKhoaGoc}'.` };
  const hangMa = match[1];
  const soKhoa = parseInt(match[2], 10);

  const hoTenLike = `%${hoTenCan.split(' ').join('%')}%`;

  // Fallback to DrivingManagement if not found
  let dsKhoa: any[] = [];
  const tenCuoi = hoTenCan.split(' ').pop() ?? hoTenCan;
  const hoTenLikeSql = `%${tenCuoi}%`;

  const paramsSync = {
    maCS: { kieu: sql.VarChar, gt: maCoSo },
    hoTenLike: { kieu: sql.NVarChar, gt: hoTenLikeSql },
  };

  const qSyncNhanh = `
    SET NOCOUNT ON;
    SELECT HoVaTen, 
           NgaySinh,
           Cccd,
           DiaChi,
           HangGplxDaCo AS HangGplx,
           SoGplxDaCo AS SoGplx,
           MaHocVien,
           NgayBeGiang,
           TenKH,
           HangGPLX AS HangGplxGoc
    FROM dbo.Sync_HocVien
    WHERE MaCoSo = @maCS
      AND HoVaTen COLLATE Latin1_General_CI_AI LIKE @hoTenLike COLLATE Latin1_General_CI_AI;
  `;

  const qSyncDuPhong = `
    SET NOCOUNT ON;
    SELECT HoVaTen, 
           NgaySinh,
           Cccd,
           DiaChi,
           HangGplxDaCo AS HangGplx,
           SoGplxDaCo AS SoGplx,
           MaHocVien,
           NgayBeGiang,
           TenKH,
           HangGPLX AS HangGplxGoc
    FROM dbo.Sync_HocVien
    WHERE MaCoSo = @maCS;
  `;

  try {
    const rawKhoa = await truyVan<any>(qSyncNhanh, paramsSync);
    
    // Lọc bằng logic an toàn trên TS thay vì REPLACE trong SQL (tránh lỗi font KHÓA/KHOÁ)
    dsKhoa = rawKhoa.filter(r => {
      // Ưu tiên 1: Dùng hàm maKhoaTuTenKH để extract trực tiếp
      if (r.TenKH && maKhoaTuTenKH(r.TenKH) === maKhoaGoc) return true;
      
      // Ưu tiên 2: Fallback tìm tương đối
      const hangTrongTen = r.TenKH ? (r.TenKH.includes(` ${hangMa} `) || r.TenKH.startsWith(`${hangMa} `) || r.TenKH.includes(`${hangMa}K`)) : false;
      const dungHang = r.HangGplxGoc ? r.HangGplxGoc.trim() === hangMa : hangTrongTen;
      const dungKhoa = r.TenKH?.includes(soKhoa.toString());
      return (dungHang || hangTrongTen) && dungKhoa;
    });
    
    if (dsKhoa.length === 0) {
      // Fallback lấy toàn bộ và lọc
      const rawAll = await truyVan<any>(qSyncDuPhong, { maCS: { kieu: sql.VarChar, gt: maCoSo } });
      dsKhoa = rawAll.filter(r => {
        if (r.TenKH && maKhoaTuTenKH(r.TenKH) === maKhoaGoc) return true;
        const hangTrongTen = r.TenKH ? (r.TenKH.includes(` ${hangMa} `) || r.TenKH.startsWith(`${hangMa} `) || r.TenKH.includes(`${hangMa}K`)) : false;
        const dungHang = r.HangGplxGoc ? r.HangGplxGoc.trim() === hangMa : hangTrongTen;
        const dungKhoa = r.TenKH?.includes(soKhoa.toString());
        return (dungHang || hangTrongTen) && dungKhoa;
      });
    }
  } catch (e) {
    console.error("Lỗi truy vấn Sync_HocVien:", e);
  }

  if (dsKhoa.length === 0) {
    // Fallback: tìm trong CSDL web (DrivingManagement)
    const qDm = `
      SET NOCOUNT ON;
      SELECT hv.HoTen AS HoVaTen,
        ISNULL(CONVERT(varchar,hv.NgaySinh,103),'') AS NgaySinh,
        ISNULL(hv.Cccd,'') AS Cccd,
        ISNULL(hv.NoiThuongTru,'') AS DiaChi,
        ISNULL(hv.HangGplxDaCo,'') AS HangGplx,
        ISNULL(hv.SoGplxDaCo,'') AS SoGplx,
        ISNULL(hvk.MaHocVien,'') AS MaHocVien,
        ISNULL(CONVERT(varchar(10),k.NgayBeGiang,120),'') AS NgayBeGiang
      FROM dbo.HocVienKhoa hvk
      JOIN dbo.HocVien hv ON hv.HocVienId = hvk.HocVienId
      JOIN dbo.Khoa k       ON k.KhoaId    = hvk.KhoaId
      JOIN dbo.DonVi dv     ON dv.DonViId  = k.DonViId
      WHERE dv.MaCoSo = @maCS
        AND k.HangMa  = @hangMa
        AND k.SoKhoa  = @soKhoa;
    `;
    try {
      dsKhoa = await truyVan(qDm, { 
        maCS: { kieu: sql.VarChar, gt: maCoSo },
        hangMa: { kieu: sql.VarChar, gt: hangMa },
        soKhoa: { kieu: sql.Int, gt: soKhoa },
      });
    } catch(e) {}
  }

  if (dsKhoa.length === 0) {
    return { ok: false, ma: "KHONG_CO_KHOA", thongBao: `Không có dữ liệu khóa ${maKhoaGoc} ở cơ sở ${maCoSo}.` };
  }

  const boDau = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase().trim();
  const tenCan = boDau(hoTenCan);

  let ungVien = dsKhoa.filter(x => boDau(x.HoVaTen) === tenCan);
  
  if (ngaySinh && ungVien.length > 1) {
    // format ngaySinh to yyyy-mm-dd format for comparison if it is dd/mm/yyyy
    let nsYMD = ngaySinh;
    if (ngaySinh.includes("/")) {
      const [d, m, y] = ngaySinh.split("/");
      nsYMD = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const hep = ungVien.filter(x => {
      let xNs = x.NgaySinh; // dd/mm/yyyy
      if (xNs.includes("/")) {
        const [d, m, y] = xNs.split("/");
        xNs = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else if (xNs.includes("-")) {
        xNs = xNs.substring(0, 10);
      }
      return xNs === nsYMD;
    });
    if (hep.length > 0) ungVien = hep;
  }

  if (ungVien.length === 0) {
    return { ok: false, ma: "KHONG_TIM_THAY", thongBao: `Không tìm thấy '${hoTenCan}' trong khóa ${maKhoaGoc}.` };
  }
  if (ungVien.length > 1) {
    return {
      ok: false, ma: "TRUNG_TEN",
      thongBao: `Có ${ungVien.length} người tên '${hoTenCan}' trong khóa ${maKhoaGoc} — nhập thêm ngày sinh để phân biệt.`,
      candidates: ungVien.map(x => ({ ngaySinh: x.NgaySinh, cccd: x.Cccd }))
    };
  }

  const x = ungVien[0];
  const cachKhop = ngaySinh ? "TEN_NGAYSINH" : "CCCD";

  const ngayBg = x.NgayBeGiang;
  if (ngayThi && ngayBg) {
    const dThi = new Date(ngayThi);
    const dBg = new Date(ngayBg);
    if (dBg > dThi) {
      return { ok: false, ma: "CHUA_BE_GIANG", thongBao: `Khóa ${maKhoaGoc} chưa bế giảng (dự kiến ${ngayBg}) — chưa đủ điều kiện ghép vào đợt thi ${ngayThi}.` };
    }
    const diffTime = Math.abs(dThi.getTime() - dBg.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays > 365) {
      return { ok: false, ma: "QUA_HAN_MOT_NAM", thongBao: `Khóa ${maKhoaGoc} đã bế giảng ${ngayBg}, quá 1 năm so với ngày ghép ${ngayThi} — không còn được ghép khóa.` };
    }
  }

  const script = `
    SET NOCOUNT ON; SET XACT_ABORT ON; SET QUOTED_IDENTIFIER ON;
    DECLARE @dv int = (SELECT DonViId FROM dbo.DonVi WHERE MaCoSo = @maCS);
    IF @dv IS NULL BEGIN RAISERROR(N'khong co don vi ma co so', 16, 1); RETURN; END
    BEGIN TRAN;

    MERGE dbo.Khoa AS t
    USING (SELECT @dv AS DonViId, @hangMa AS HangMa, @soKhoa AS SoKhoa,
                  @ngayBg AS NgayBeGiang) AS n
       ON t.DonViId=n.DonViId AND t.HangMa=n.HangMa AND t.SoKhoa=n.SoKhoa
    WHEN MATCHED AND n.NgayBeGiang IS NOT NULL AND t.NgayBeGiang IS NULL
         THEN UPDATE SET NgayBeGiang=n.NgayBeGiang
    WHEN NOT MATCHED THEN INSERT (DonViId,HangMa,SoKhoa,NgayBeGiang)
         VALUES (n.DonViId,n.HangMa,n.SoKhoa,n.NgayBeGiang);
    DECLARE @k int = (SELECT KhoaId FROM dbo.Khoa WHERE DonViId=@dv AND HangMa=@hangMa AND SoKhoa=@soKhoa);

    MERGE dbo.HocVien AS t
    USING (SELECT @cccd AS Cccd, @hoTen AS HoTen,
                  @ns AS NgaySinh,
                  @dc AS DiaChi, @soGplx AS SoGplx,
                  @hangGplx AS HangGplx) AS n
       ON t.Cccd = n.Cccd
    WHEN NOT MATCHED THEN INSERT (Cccd,HoTen,NgaySinh,NoiThuongTru,SoGplxDaCo,HangGplxDaCo)
         VALUES (n.Cccd,n.HoTen,n.NgaySinh,n.DiaChi,n.SoGplx,n.HangGplx);
    DECLARE @hv int = (SELECT HocVienId FROM dbo.HocVien WHERE Cccd = @cccd);

    MERGE dbo.HocVienKhoa AS t
    USING (SELECT @k AS KhoaId, @hv AS HocVienId,
                  NULLIF(@maHV, '') AS MaHocVien) AS n
       ON t.KhoaId=n.KhoaId AND t.HocVienId=n.HocVienId
    WHEN MATCHED AND n.MaHocVien IS NOT NULL THEN UPDATE SET MaHocVien=n.MaHocVien, CapNhatLuc=SYSDATETIMEOFFSET()
    WHEN NOT MATCHED THEN INSERT (KhoaId,HocVienId,MaHocVien,KetQuaTotNghiep)
         VALUES (n.KhoaId,n.HocVienId,n.MaHocVien,'VANG_THI');
    DECLARE @hvk int = (SELECT HocVienKhoaId FROM dbo.HocVienKhoa WHERE KhoaId=@k AND HocVienId=@hv);

    UPDATE dbo.DangKyGhepKhoa
       SET HocVienKhoaId=@hvk, CachKhop=@cachKhop, TrangThai='DUYET',
           NguoiDuyetId=NULL, DuyetLuc=SYSDATETIMEOFFSET(), CapNhatLuc=SYSDATETIMEOFFSET()
     WHERE DangKyId=@dkId AND TrangThai <> 'TU_CHOI';

    COMMIT TRAN;
  `;

  let xNsYMD: string | null = null;
  if (x.NgaySinh) {
    if (x.NgaySinh.includes("/")) {
      const [d, m, y] = x.NgaySinh.split("/");
      xNsYMD = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
      xNsYMD = x.NgaySinh.substring(0, 10);
    }
  }

  try {
    const p = await pool();
    const req = p.request();
    req.input("maCS", sql.VarChar, maCoSo);
    req.input("hangMa", sql.VarChar, hangMa);
    req.input("soKhoa", sql.Int, soKhoa);
    req.input("ngayBg", sql.Date, ngayBg || null);
    req.input("cccd", sql.VarChar, x.Cccd);
    req.input("hoTen", sql.NVarChar, x.HoVaTen);
    req.input("ns", sql.Date, xNsYMD);
    req.input("dc", sql.NVarChar, x.DiaChi);
    req.input("soGplx", sql.VarChar, x.SoGplx);
    req.input("hangGplx", sql.VarChar, x.HangGplx);
    req.input("maHV", sql.VarChar, x.MaHocVien);
    req.input("cachKhop", sql.VarChar, cachKhop);
    req.input("dkId", sql.Int, dangKyId);
    
    await req.query(script);
  } catch (e) {
    return { ok: false, ma: "LOI_LUU", thongBao: `Lỗi khi lưu vào cơ sở dữ liệu: ${(e as Error).message}` };
  }

  return {
    ok: true,
    cach: cachKhop,
    hoTen: x.HoVaTen,
    ngaySinh: xNsYMD || "",
    cccd: x.Cccd,
    diaChi: x.DiaChi,
    hangGplx: x.HangGplx,
    soGplx: x.SoGplx,
    maHocVien: x.MaHocVien,
    maKhoaGoc
  };
}

export async function timKiemHoSo(opt: {
  donViId?: number | null;
  hangMa?: string;
  maKhoa?: string;
  giaoVien?: string;
  trangThai?: string;
  ngayGhep?: string;
  tuKhoa?: string;
  trang?: number;
  soDong?: number;
}) {
  if (opt.maKhoa) {
    try {
      await dongBoKhoaGPLX(opt.maKhoa);
    } catch (err) {
      console.error("Lỗi đồng bộ GPLX_CSDT:", err);
    }
  }

  const ts: any = {};
  const dk = ["hs.DaXoa = 0"];

  if (opt.hangMa) {
    dk.push("hs.HangMa = @hang");
    ts.hang = { kieu: sql.VarChar, gt: opt.hangMa };
  }
  if (opt.maKhoa) {
    dk.push("hs.MaKhoa = @khoa");
    ts.khoa = { kieu: sql.VarChar, gt: opt.maKhoa };
  }
  if (opt.giaoVien) {
    dk.push("hs.GiaoVien LIKE @gv");
    ts.gv = { kieu: sql.NVarChar, gt: `%${opt.giaoVien}%` };
  }
  if (opt.trangThai) {
    dk.push("hs.TrangThaiHoSo = @tt");
    ts.tt = { kieu: sql.VarChar, gt: opt.trangThai };
  }
  if (opt.ngayGhep) {
    dk.push(`EXISTS (
      SELECT 1 FROM dbo.DangKyGhepKhoa _dk
      JOIN dbo.vw_Dot _dot ON _dot.DotId = _dk.DotId
      WHERE _dk.CccdKhai = hs.Cccd 
        AND _dk.MaKhoaGocKhai = hs.MaKhoa
        AND _dk.TrangThai = 'DUYET'
        AND _dot.NgayThi = @ngayGhep
    )`);
    ts.ngayGhep = { kieu: sql.Date, gt: opt.ngayGhep };
  }
  if (opt.tuKhoa) {
    dk.push("(hs.HoTen LIKE @tk OR hs.Cccd LIKE @tk OR hs.SoDienThoai LIKE @tk OR hs.GiaoVien LIKE @tk)");
    ts.tk = { kieu: sql.NVarChar, gt: `%${opt.tuKhoa}%` };
  }

  const where = "WHERE " + dk.join(" AND ");
  const countRes = await motDong<{ Total: number }>(
    `SELECT COUNT(*) AS Total FROM dbo.HoSoHocVien hs ${where}`,
    ts
  );
  const tong = countRes?.Total || 0;

  const trang = Math.max(1, opt.trang || 1);
  const soDong = Math.max(1, opt.soDong || 50);
  const skip = (trang - 1) * soDong;

  const query = `
    SELECT hs.*, 
           ghep.MaKhoaDich, ghep.NgayThi AS NgayThiDich
    FROM dbo.HoSoHocVien hs
    OUTER APPLY (
        SELECT TOP 1 dot.MaKhoaDich, dot.NgayThi
        FROM dbo.DangKyGhepKhoa d
        JOIN dbo.vw_Dot dot ON dot.DotId = d.DotId
        WHERE d.CccdKhai = hs.Cccd 
          AND d.MaKhoaGocKhai = hs.MaKhoa 
          AND d.TrangThai = 'DUYET'
        ORDER BY d.TaoLuc DESC
    ) ghep
    ${where}
    ORDER BY hs.MaKhoa DESC, hs.HoTen ASC
    OFFSET ${skip} ROWS FETCH NEXT ${soDong} ROWS ONLY
  `;

  const danhSach = await truyVan<HoSoHocVien>(query, ts);

  return {
    danhSach,
    tong,
    trang,
    soDong,
    tongTrang: Math.ceil(tong / soDong),
  };
}

export async function chiTietLichSuHoSo(hoSoId: number) {
  return truyVan<LichSuHoSoItem>(
    `SELECT ls.*, ISNULL(nd.HoTen, 'Hệ thống') AS NguoiDung
     FROM dbo.LichSuHoSo ls
     LEFT JOIN dbo.NguoiDung nd ON ls.NguoiDungId = nd.NguoiDungId
     WHERE ls.HoSoId = @hsId
     ORDER BY ls.ThoiDiem DESC`,
    { hsId: { kieu: sql.Int, gt: hoSoId } }
  );
}

