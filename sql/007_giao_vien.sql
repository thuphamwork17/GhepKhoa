/* ============================================================================
   Thêm cột "Giáo viên" vào đăng ký ghép khóa — ghi nhận thầy/cô đứng ra khai
   báo/nộp phiếu cho học viên đó, để về sau còn tra được phiếu giấy này do ai
   mang lên khi cần đối chiếu hoặc hỏi lại.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.DangKyGhepKhoa', 'GiaoVien') IS NULL
  ALTER TABLE dbo.DangKyGhepKhoa ADD GiaoVien nvarchar(120) NULL;
GO

/* Đăng ký kèm mọi thứ cần hiển thị và xuất file, gồm cả dữ liệu chuẩn lấy từ
   hồ sơ khóa cũ (nếu đã đối chiếu được). Chép lại từ 003, chỉ thêm GiaoVien. */
CREATE OR ALTER VIEW dbo.vw_DangKy AS
SELECT
  k.DangKyId, k.DotId, d.DonViId, d.MaCoSo, d.TenVietTat, d.MaKhoaDich, d.NgayThi, d.Ten AS TenDot,
  k.HoTenKhai, k.NgaySinhKhai, k.CccdKhai, k.DiaChiKhai, k.MaKhoaGocKhai,
  k.SoDienThoai, k.GhiChuKhai, k.GiaoVien, k.TrangThai, k.LyDoTuChoi, k.CachKhop,
  k.HocVienKhoaId, k.TaoLuc, k.DuyetLuc,
  nd.HoTen AS NguoiDuyet,
  /* dữ liệu chuẩn từ hồ sơ — cái sẽ được in ra văn bản */
  HoTenHoSo     = hv.HoTen,
  NgaySinhHoSo  = hv.NgaySinh,
  CccdHoSo      = hv.Cccd,
  DiaChiHoSo    = hv.NoiThuongTru,
  SoGplxDaCo    = hv.SoGplxDaCo,
  HangGplxDaCo  = hv.HangGplxDaCo,
  MaHocVien     = hvk.MaHocVien,
  MaKhoaGocHoSo = kg.MaKhoa,
  KetQuaKhoaGoc = hvk.KetQuaTotNghiep,
  /* cờ để cán bộ soi nhanh những chỗ lệch */
  LechCccd  = CONVERT(bit, CASE WHEN hv.Cccd  IS NOT NULL AND hv.Cccd  <> k.CccdKhai      THEN 1 ELSE 0 END),
  LechKhoa  = CONVERT(bit, CASE WHEN kg.MaKhoa IS NOT NULL AND kg.MaKhoa <> k.MaKhoaGocKhai THEN 1 ELSE 0 END)
FROM dbo.DangKyGhepKhoa k
JOIN dbo.vw_Dot d              ON d.DotId = k.DotId
LEFT JOIN dbo.HocVienKhoa hvk  ON hvk.HocVienKhoaId = k.HocVienKhoaId
LEFT JOIN dbo.HocVien hv       ON hv.HocVienId = hvk.HocVienId
LEFT JOIN dbo.Khoa kg          ON kg.KhoaId = hvk.KhoaId
LEFT JOIN dbo.NguoiDung nd     ON nd.NguoiDungId = k.NguoiDuyetId;
GO

/* Nhận một đăng ký mới. Chép lại từ 003, chỉ thêm @GiaoVien. */
CREATE OR ALTER PROCEDURE dbo.sp_TaoDangKy
  @DotId         int,
  @HoTen         nvarchar(120),
  @MaKhoaGoc     varchar(20),
  @NgaySinh      date          = NULL,
  @Cccd          varchar(12)   = NULL,
  @SoDienThoai   varchar(15)   = NULL,
  @DiaChi        nvarchar(400) = NULL,
  @GhiChu        nvarchar(300) = NULL,
  @GiaoVien      nvarchar(120) = NULL,
  @DiaChiIp      varchar(45)   = NULL,
  @DangKyId      int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRAN;

    DECLARE @DangMo bit, @TrangThai varchar(12), @Han date, @ToiDa smallint, @DaCo int;

    SELECT @DangMo = d.DangMo, @TrangThai = d.TrangThai,
           @Han = d.HanDangKy, @ToiDa = d.SoLuongToiDa
      FROM dbo.DotGhepKhoa d WITH (UPDLOCK, HOLDLOCK)
     WHERE d.DotId = @DotId;

    IF @@ROWCOUNT = 0
    BEGIN
      ROLLBACK TRAN;
      THROW 50001, N'Đợt ghép khóa không tồn tại.', 1;
    END

    IF @DangMo = 0 OR @TrangThai <> 'MO'
    BEGIN
      ROLLBACK TRAN;
      THROW 50002, N'Đợt này đã đóng đăng ký.', 1;
    END

    IF @Han IS NOT NULL AND @Han < CAST(SYSDATETIME() AS date)
    BEGIN
      ROLLBACK TRAN;
      THROW 50003, N'Đã quá hạn đăng ký của đợt này.', 1;
    END

    IF @Cccd IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.DangKyGhepKhoa WHERE DotId = @DotId AND CccdKhai = @Cccd)
    BEGIN
      ROLLBACK TRAN;
      THROW 50005, N'Số CCCD này đã đăng ký đợt đó rồi.', 1;
    END

    IF EXISTS (SELECT 1 FROM dbo.DangKyGhepKhoa
                WHERE DotId = @DotId AND HoTenKhai = @HoTen
                  AND MaKhoaGocKhai = UPPER(@MaKhoaGoc))
    BEGIN
      ROLLBACK TRAN;
      THROW 50006, N'Người này đã đăng ký đợt đó với cùng khóa cũ rồi.', 1;
    END

    IF @ToiDa IS NOT NULL
    BEGIN
      SELECT @DaCo = COUNT(*) FROM dbo.DangKyGhepKhoa
       WHERE DotId = @DotId AND TrangThai <> 'TU_CHOI';
      IF @DaCo >= @ToiDa
      BEGIN
        ROLLBACK TRAN;
        THROW 50004, N'Đợt này đã đủ số lượng.', 1;
      END
    END

    INSERT dbo.DangKyGhepKhoa
      (DotId, HoTenKhai, NgaySinhKhai, CccdKhai, DiaChiKhai,
       MaKhoaGocKhai, SoDienThoai, GhiChuKhai, GiaoVien, DiaChiIp)
    VALUES
      (@DotId, @HoTen, @NgaySinh, @Cccd, NULLIF(LTRIM(RTRIM(@DiaChi)), N''),
       UPPER(@MaKhoaGoc), @SoDienThoai, NULLIF(LTRIM(RTRIM(@GhiChu)), N''),
       NULLIF(LTRIM(RTRIM(@GiaoVien)), N''), @DiaChiIp);

    SET @DangKyId = SCOPE_IDENTITY();

  COMMIT TRAN;

  /* Đối chiếu ngay để cán bộ mở lên là thấy sẵn kết quả khớp. */
  EXEC dbo.sp_DoiChieuDangKy @DangKyId = @DangKyId;
END
GO

/* vw_DangKySapXep (004) đọc "SELECT v.*" từ vw_DangKy — SQL Server chỉ chốt
   danh sách cột của "*" lúc tạo view, không tự cập nhật khi view nguồn đổi
   cột. Không refresh thì GiaoVien vừa thêm sẽ làm lệch hết các cột phía sau
   nó sang một vị trí trong mọi kết quả đọc qua vw_DangKySapXep.               */
EXEC sp_refreshview N'dbo.vw_DangKySapXep';
GO

PRINT N'007_giao_vien.sql — xong.';
GO
