/* ============================================================================
   View và stored procedure.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

/* Đợt kèm số đã đăng ký và số chỗ còn lại — dùng cho cả trang học viên và
   trang quản trị, để hai nơi không tự đếm mỗi nơi một kiểu.                  */
CREATE OR ALTER VIEW dbo.vw_Dot AS
SELECT
  d.DotId, d.DonViId, dv.MaCoSo, dv.TenVietTat, dv.TenDayDu AS TenDonVi, dv.LoaiDonVi,
  d.MaKhoaDich, d.Ten, d.NgayThi, d.HanDangKy, d.SoLuongToiDa, d.DiaDiemThi,
  d.DangMo, d.TrangThai, d.TaoLuc,
  SoDangKy   = ISNULL(k.SoDangKy, 0),
  SoDaDuyet  = ISNULL(k.SoDaDuyet, 0),
  SoChoDuyet = ISNULL(k.SoChoDuyet, 0),
  SoTuChoi   = ISNULL(k.SoTuChoi, 0),
  ConLai     = CASE WHEN d.SoLuongToiDa IS NULL THEN NULL
                    ELSE d.SoLuongToiDa - ISNULL(k.SoDangKy, 0) END,
  ConNhanDangKy = CONVERT(bit, CASE
      WHEN d.DangMo = 0 OR d.TrangThai <> 'MO' THEN 0
      WHEN d.HanDangKy IS NOT NULL AND d.HanDangKy < CAST(SYSDATETIME() AS date) THEN 0
      WHEN d.SoLuongToiDa IS NOT NULL AND ISNULL(k.SoDangKy, 0) >= d.SoLuongToiDa THEN 0
      ELSE 1 END)
FROM dbo.DotGhepKhoa d
JOIN dbo.DonVi dv ON dv.DonViId = d.DonViId
OUTER APPLY (
  SELECT
    SoDangKy   = COUNT_BIG(*),
    SoDaDuyet  = SUM(CASE WHEN k.TrangThai = 'DUYET'     THEN 1 ELSE 0 END),
    SoChoDuyet = SUM(CASE WHEN k.TrangThai = 'CHO_DUYET' THEN 1 ELSE 0 END),
    SoTuChoi   = SUM(CASE WHEN k.TrangThai = 'TU_CHOI'   THEN 1 ELSE 0 END)
  FROM dbo.DangKyGhepKhoa k
  WHERE k.DotId = d.DotId AND k.TrangThai <> 'TU_CHOI'
) k;
GO

/* Đăng ký kèm mọi thứ cần hiển thị và xuất file, gồm cả dữ liệu chuẩn lấy từ
   hồ sơ khóa cũ (nếu đã đối chiếu được).                                     */
CREATE OR ALTER VIEW dbo.vw_DangKy AS
SELECT
  k.DangKyId, k.DotId, d.DonViId, d.MaCoSo, d.TenVietTat, d.MaKhoaDich, d.NgayThi, d.Ten AS TenDot,
  k.HoTenKhai, k.NgaySinhKhai, k.CccdKhai, k.DiaChiKhai, k.MaKhoaGocKhai,
  k.SoDienThoai, k.GhiChuKhai, k.TrangThai, k.LyDoTuChoi, k.CachKhop,
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

/* Học viên còn nợ tốt nghiệp — nguồn để lập danh sách ghép khóa. */
CREATE OR ALTER VIEW dbo.vw_HocVienChoGhep AS
SELECT
  hvk.HocVienKhoaId, hvk.KhoaId, k.MaKhoa AS MaKhoaGoc, k.HangMa, k.SoKhoa,
  h.ThuTu AS ThuTuHang, dv.DonViId, dv.MaCoSo, dv.TenVietTat,
  hv.HocVienId, hv.Cccd, hv.HoTen, hv.NgaySinh, hv.NoiThuongTru,
  hv.SoGplxDaCo, hv.HangGplxDaCo, hvk.MaHocVien, hvk.SoThuTu,
  hvk.KetQuaTotNghiep, hvk.KhoaGhepToiId, kd.MaKhoa AS MaKhoaGhepToi
FROM dbo.HocVienKhoa hvk
JOIN dbo.Khoa k       ON k.KhoaId = hvk.KhoaId
JOIN dbo.HangGPLX h   ON h.HangMa = k.HangMa
JOIN dbo.DonVi dv     ON dv.DonViId = k.DonViId
JOIN dbo.HocVien hv   ON hv.HocVienId = hvk.HocVienId
LEFT JOIN dbo.Khoa kd ON kd.KhoaId = hvk.KhoaGhepToiId
WHERE hvk.KetQuaTotNghiep <> 'DAT';
GO

/* ------------------------------------------------------------------------ */
/* Nhận một đăng ký mới.

   Việc kiểm tra sức chứa và việc chèn phải nằm trong cùng một giao tác, khóa
   dòng đợt lại — nếu không, hai người bấm gửi cùng lúc sẽ cùng đọc thấy "còn
   1 chỗ" rồi cùng ghi vào, vượt quá số lượng tối đa.                         */
CREATE OR ALTER PROCEDURE dbo.sp_TaoDangKy
  @DotId         int,
  @HoTen         nvarchar(120),
  @MaKhoaGoc     varchar(20),
  /* Phiếu giấy chỉ có họ tên + khóa cũ + đợt. Ba thứ dưới đây thường trống:
     ngày sinh và CCCD đã có sẵn trong hồ sơ khóa cũ, lấy ra khi đối chiếu. */
  @NgaySinh      date          = NULL,
  @Cccd          varchar(12)   = NULL,
  @SoDienThoai   varchar(15)   = NULL,
  @DiaChi        nvarchar(400) = NULL,
  @GhiChu        nvarchar(300) = NULL,
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

    /* Kiểm tra trùng TRƯỚC khi kiểm tra sức chứa: người đã đăng ký rồi mà bấm
       gửi lại thì phải được báo "đã đăng ký rồi", chứ báo "đã đủ số lượng" là
       sai sự thật và khiến họ tưởng mình bị loại.

       Phải kiểm cả hai kiểu trùng. Có CCCD thì CCCD là định danh chắc nhất;
       không có CCCD thì dựa vào tên + khóa cũ. Nếu để chỉ mục duy nhất chặn
       thay thì SQL ném lỗi kỹ thuật và làm hỏng cả giao tác, người dùng nhận
       được một thông báo không hiểu gì.                                      */
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
       MaKhoaGocKhai, SoDienThoai, GhiChuKhai, DiaChiIp)
    VALUES
      (@DotId, @HoTen, @NgaySinh, @Cccd, NULLIF(LTRIM(RTRIM(@DiaChi)), N''),
       UPPER(@MaKhoaGoc), @SoDienThoai, NULLIF(LTRIM(RTRIM(@GhiChu)), N''), @DiaChiIp);

    SET @DangKyId = SCOPE_IDENTITY();

  COMMIT TRAN;

  /* Đối chiếu ngay để cán bộ mở lên là thấy sẵn kết quả khớp. */
  EXEC dbo.sp_DoiChieuDangKy @DangKyId = @DangKyId;
END
GO

/* Tìm hồ sơ khóa cũ tương ứng với một đăng ký.
   Ưu tiên CCCD; không thấy mới dò tên + ngày sinh. Chỉ nhận khi kết quả duy
   nhất — mơ hồ thì để trống cho cán bộ tự chọn, không đoán bừa.              */
CREATE OR ALTER PROCEDURE dbo.sp_DoiChieuDangKy
  @DangKyId int
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Cccd varchar(12), @HoTen nvarchar(120), @NgaySinh date, @MaKhoaGoc varchar(20);
  SELECT @Cccd = CccdKhai, @HoTen = HoTenKhai, @NgaySinh = NgaySinhKhai,
         @MaKhoaGoc = MaKhoaGocKhai
    FROM dbo.DangKyGhepKhoa WHERE DangKyId = @DangKyId;

  IF @Cccd IS NULL RETURN;

  DECLARE @HvkId int, @Cach varchar(16);

  /* 1 — theo CCCD, ưu tiên đúng khóa học viên tự khai */
  SELECT TOP (1) @HvkId = v.HocVienKhoaId, @Cach = 'CCCD'
    FROM dbo.vw_HocVienChoGhep v
   WHERE v.Cccd = @Cccd
   ORDER BY CASE WHEN v.MaKhoaGoc = @MaKhoaGoc THEN 0 ELSE 1 END, v.KhoaId DESC;

  /* 2 — theo tên + ngày sinh, chỉ nhận khi duy nhất */
  IF @HvkId IS NULL
  BEGIN
    SELECT @HvkId = MIN(v.HocVienKhoaId), @Cach = 'TEN_NGAYSINH'
      FROM dbo.vw_HocVienChoGhep v
     WHERE v.HoTen = @HoTen AND v.NgaySinh = @NgaySinh
    HAVING COUNT(*) = 1;
  END

  UPDATE dbo.DangKyGhepKhoa
     SET HocVienKhoaId = @HvkId,
         CachKhop      = CASE WHEN @HvkId IS NULL THEN NULL ELSE @Cach END,
         CapNhatLuc    = SYSDATETIMEOFFSET()
   WHERE DangKyId = @DangKyId
     AND (CachKhop IS NULL OR CachKhop <> 'THU_CONG');  -- không đè lên lựa chọn tay
END
GO

/* Đổi trạng thái một đăng ký, có ghi nhật ký. */
CREATE OR ALTER PROCEDURE dbo.sp_DuyetDangKy
  @DangKyId    int,
  @TrangThai   varchar(12),
  @NguoiDungId int          = NULL,
  @LyDo        nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @TrangThai NOT IN ('CHO_DUYET', 'DUYET', 'TU_CHOI')
    THROW 50010, N'Trạng thái không hợp lệ.', 1;

  IF @TrangThai = 'DUYET'
     AND NOT EXISTS (SELECT 1 FROM dbo.DangKyGhepKhoa
                      WHERE DangKyId = @DangKyId AND HocVienKhoaId IS NOT NULL)
    THROW 50011, N'Chưa đối chiếu được đăng ký này với hồ sơ khóa cũ nên không duyệt được.', 1;

  IF @TrangThai = 'TU_CHOI' AND NULLIF(LTRIM(RTRIM(@LyDo)), N'') IS NULL
    THROW 50012, N'Trả lại đăng ký thì phải nêu lý do.', 1;

  BEGIN TRAN;
    UPDATE dbo.DangKyGhepKhoa
       SET TrangThai    = @TrangThai,
           LyDoTuChoi   = CASE WHEN @TrangThai = 'TU_CHOI' THEN @LyDo ELSE NULL END,
           NguoiDuyetId = CASE WHEN @TrangThai = 'CHO_DUYET' THEN NULL ELSE @NguoiDungId END,
           DuyetLuc     = CASE WHEN @TrangThai = 'CHO_DUYET' THEN NULL ELSE SYSDATETIMEOFFSET() END,
           CapNhatLuc   = SYSDATETIMEOFFSET()
     WHERE DangKyId = @DangKyId;

    INSERT dbo.NhatKy (NguoiDungId, HanhDong, Bang, KhoaChinh, NoiDung)
    VALUES (@NguoiDungId, 'DOI_TRANG_THAI', 'DangKyGhepKhoa',
            CONVERT(varchar(40), @DangKyId),
            N'→ ' + @TrangThai + ISNULL(N' — ' + @LyDo, N''));
  COMMIT TRAN;
END
GO

PRINT N'003_view_thutuc.sql — xong.';
GO
