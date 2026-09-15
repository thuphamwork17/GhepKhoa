/* ============================================================================
   Dữ liệu gốc: hai đơn vị và bảng hạng GPLX.
   Chạy lại nhiều lần được — MERGE theo khóa tự nhiên, không tạo trùng.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;   -- bắt buộc: bảng Khoa có index trên cột tính sẵn
SET XACT_ABORT ON;
GO

/* Số liệu lấy từ chính các file .xls đang dùng:
     92001 — "Bao cao 1 c1k52.xls", mã học viên 92001-…, ký "KT. HIỆU TRƯỞNG"
     92004 — "Bao cao 1 C1K82 TT 2026.xls", mã học viên 92004-…, ký "GIÁM ĐỐC" */
MERGE dbo.DonVi AS d
USING (VALUES
  ('92001', 'TRUONG',    N'Trường Cao đẳng Tây Đô',
                          N'CĐ Tây Đô',
                          N'TRÖÔØNG CAO ĐẲNG TAÂY ÑOÂ',
                          N'Công ty CP Bến xe Tàu phà Cần Thơ',
                          N'KT. HIỆU TRƯỞNG', N'P. Hiệu Trưởng', N'Trần Thị Vinh',
                          N'Mau\DS ghép khóa TN mau BK-CDTD.xls'),
  ('92004', 'TRUNG_TAM', N'Trung tâm GDNN Đào tạo và Sát hạch lái xe cơ giới đường bộ Tây Đô',
                          N'TT Tây Đô',
                          N'TT GDNN ÑT&SH LX CG ÑB TAÂY ÑOÂ',
                          N'Công ty CP Bến xe Tàu phà Cần Thơ',
                          N'GIÁM ĐỐC', NULL, N'Phùng Chí Thành',
                          N'Mau\DS ghép khóa TN mau C1-TTTD.xls')
) AS n (MaCoSo, LoaiDonVi, TenDayDu, TenVietTat, TenTrenVanBan,
        CoQuanChuQuan, ChucDanhKy, ChucDanhPhu, NguoiKy, MauVanBan)
  ON d.MaCoSo = n.MaCoSo
WHEN MATCHED THEN UPDATE SET
  d.LoaiDonVi = n.LoaiDonVi, d.TenDayDu = n.TenDayDu, d.TenVietTat = n.TenVietTat,
  d.TenTrenVanBan = n.TenTrenVanBan, d.CoQuanChuQuan = n.CoQuanChuQuan,
  d.ChucDanhKy = n.ChucDanhKy, d.ChucDanhPhu = n.ChucDanhPhu, d.NguoiKy = n.NguoiKy,
  d.MauVanBan = n.MauVanBan, d.CapNhatLuc = SYSDATETIMEOFFSET()
WHEN NOT MATCHED BY TARGET THEN INSERT
  (MaCoSo, LoaiDonVi, TenDayDu, TenVietTat, TenTrenVanBan,
   CoQuanChuQuan, ChucDanhKy, ChucDanhPhu, NguoiKy, MauVanBan)
  VALUES (n.MaCoSo, n.LoaiDonVi, n.TenDayDu, n.TenVietTat, n.TenTrenVanBan,
          n.CoQuanChuQuan, n.ChucDanhKy, n.ChucDanhPhu, n.NguoiKy, n.MauVanBan);
GO

/* ThuTu = thứ tự các nhóm khóa khi in danh sách dự thi.
   Đối chiếu bản mẫu C1K82: BK134… → C1K74… → B-D2K247 → CEK140…             */
MERGE dbo.HangGPLX AS h
USING (VALUES
  ('B',     N'Hạng B',                     10),
  ('B1',    N'Hạng B1',                    20),
  ('B2',    N'Hạng B2',                    30),
  ('C1',    N'Hạng C1',                    40),
  ('C',     N'Hạng C',                     50),
  ('B-D2',  N'Hạng B nâng D2',             60),
  ('D2',    N'Hạng D2',                    70),
  ('CE',    N'Hạng CE',                    80),
  ('D',     N'Hạng D',                     90),
  ('E',     N'Hạng E',                    100),
  ('FC',    N'Hạng FC',                   110)
) AS n (HangMa, TenHang, ThuTu)
  ON h.HangMa = n.HangMa
WHEN MATCHED THEN UPDATE SET h.TenHang = n.TenHang, h.ThuTu = n.ThuTu
WHEN NOT MATCHED BY TARGET THEN INSERT (HangMa, TenHang, ThuTu)
  VALUES (n.HangMa, n.TenHang, n.ThuTu);
GO

PRINT N'002_du_lieu_goc.sql — xong.';
GO
