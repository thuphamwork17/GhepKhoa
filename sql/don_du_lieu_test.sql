/* ============================================================================
   Dọn sạch dữ liệu thử nghiệm, giữ nguyên dữ liệu nền tảng.

   XÓA : DangKyGhepKhoa (kéo theo TinhTrangHoSo do ON DELETE CASCADE),
         DotGhepKhoa, HocVienKhoa, Khoa, HocVien, LanDongBo, NhatKy.
   GIỮ : DonVi, HangGPLX, MucKiemTra, NguoiDung — đây là danh mục/tài khoản,
         không phải dữ liệu của một đợt cụ thể.

   Thứ tự xóa phải đi từ bảng con lên bảng cha để không vướng khóa ngoại:
   DangKyGhepKhoa tham chiếu DotGhepKhoa + HocVienKhoa; DotGhepKhoa và
   HocVienKhoa đều tham chiếu Khoa; Khoa tự tham chiếu chính nó
   (KhoaGhepToiId) nên phải xóa DotGhepKhoa/HocVienKhoa trước rồi mới xóa Khoa.
   ========================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

  DELETE FROM dbo.DangKyGhepKhoa;
  DELETE FROM dbo.DotGhepKhoa;
  DELETE FROM dbo.HocVienKhoa;
  DELETE FROM dbo.Khoa;
  DELETE FROM dbo.HocVien;
  DELETE FROM dbo.LanDongBo;
  DELETE FROM dbo.NhatKy;

  -- Đánh số IDENTITY lại từ đầu cho sạch, dễ theo dõi khi bắt đầu đợt thật.
  DBCC CHECKIDENT ('dbo.DangKyGhepKhoa', RESEED, 0);
  DBCC CHECKIDENT ('dbo.DotGhepKhoa',    RESEED, 0);
  DBCC CHECKIDENT ('dbo.HocVienKhoa',    RESEED, 0);
  DBCC CHECKIDENT ('dbo.Khoa',           RESEED, 0);
  DBCC CHECKIDENT ('dbo.HocVien',        RESEED, 0);
  DBCC CHECKIDENT ('dbo.LanDongBo',      RESEED, 0);
  DBCC CHECKIDENT ('dbo.NhatKy',         RESEED, 0);

COMMIT TRAN;

PRINT N'=== Còn lại sau khi dọn ===';
SELECT 'DonVi'          AS Bang, COUNT(*) AS SoDong FROM dbo.DonVi
UNION ALL SELECT 'HangGPLX',        COUNT(*) FROM dbo.HangGPLX
UNION ALL SELECT 'MucKiemTra',      COUNT(*) FROM dbo.MucKiemTra
UNION ALL SELECT 'NguoiDung',       COUNT(*) FROM dbo.NguoiDung
UNION ALL SELECT 'DangKyGhepKhoa',  COUNT(*) FROM dbo.DangKyGhepKhoa
UNION ALL SELECT 'DotGhepKhoa',     COUNT(*) FROM dbo.DotGhepKhoa
UNION ALL SELECT 'HocVienKhoa',     COUNT(*) FROM dbo.HocVienKhoa
UNION ALL SELECT 'Khoa',            COUNT(*) FROM dbo.Khoa
UNION ALL SELECT 'HocVien',         COUNT(*) FROM dbo.HocVien;

PRINT '';
PRINT N'=== Tạo đợt C1K87 cho Trung tâm, thi 23/08/2026 ===';
DECLARE @dv int = (SELECT DonViId FROM dbo.DonVi WHERE MaCoSo = '92004');
INSERT dbo.DotGhepKhoa (DonViId, MaKhoaDich, Ten, NgayThi, DangMo, TrangThai)
VALUES (@dv, 'C1K87', N'Ghép khóa C1K87', '2026-08-23', 1, 'MO');

SELECT DotId, MaKhoaDich, Ten, CONVERT(varchar(10), NgayThi, 103) AS NgayThi
  FROM dbo.DotGhepKhoa;
