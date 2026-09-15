/* ============================================================================
   Cập nhật tình trạng hồ sơ: đánh dấu tay trên màn admin, và nạp hàng loạt
   từ file DAT / học phí.

   Cả hai đều nhận JSON rồi MERGE một phát, thay vì lặp từng dòng — bảng đánh
   dấu có tới 5 mục × mấy chục người, gửi từng câu lệnh thì vừa chậm vừa dễ
   dở dang giữa chừng.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

/* Đánh dấu tay từ màn admin.
   @Json: [{"DangKyId":1,"MucId":2,"TrangThai":"DU","GhiChu":null}, …]
   TrangThai = 'CHUA_KIEM' nghĩa là xóa dòng đi, trả về trạng thái chưa ai đụng. */
CREATE OR ALTER PROCEDURE dbo.sp_CapNhatHoSo
  @Json        nvarchar(max),
  @NguoiDungId int = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @v TABLE (DangKyId int, MucId int, TrangThai varchar(12), GhiChu nvarchar(300));
  INSERT @v (DangKyId, MucId, TrangThai, GhiChu)
  SELECT DangKyId, MucId, TrangThai, NULLIF(LTRIM(RTRIM(GhiChu)), N'')
    FROM OPENJSON(@Json) WITH (
      DangKyId  int          '$.DangKyId',
      MucId     int          '$.MucId',
      TrangThai varchar(12)  '$.TrangThai',
      GhiChu    nvarchar(300) '$.GhiChu'
    );

  IF EXISTS (SELECT 1 FROM @v WHERE TrangThai NOT IN ('DU','THIEU','KHONG_CAN','CHUA_KIEM'))
    THROW 50020, N'Trạng thái hồ sơ không hợp lệ.', 1;

  BEGIN TRAN;
    DELETE t
      FROM dbo.TinhTrangHoSo t
      JOIN @v v ON v.DangKyId = t.DangKyId AND v.MucId = t.MucId
     WHERE v.TrangThai = 'CHUA_KIEM';

    MERGE dbo.TinhTrangHoSo AS t
    USING (SELECT * FROM @v WHERE TrangThai <> 'CHUA_KIEM') AS n
       ON t.DangKyId = n.DangKyId AND t.MucId = n.MucId
    WHEN MATCHED AND (t.TrangThai <> n.TrangThai
                      OR ISNULL(t.GhiChu, N'') <> ISNULL(n.GhiChu, N''))
      THEN UPDATE SET TrangThai = n.TrangThai, GhiChu = n.GhiChu,
                      NguoiCapNhatId = @NguoiDungId, LanDongBoId = NULL,
                      CapNhatLuc = SYSDATETIMEOFFSET()
    WHEN NOT MATCHED BY TARGET
      THEN INSERT (DangKyId, MucId, TrangThai, GhiChu, NguoiCapNhatId)
           VALUES (n.DangKyId, n.MucId, n.TrangThai, n.GhiChu, @NguoiDungId);
  COMMIT TRAN;

  SELECT SoDong = (SELECT COUNT(*) FROM @v);
END
GO

/* Nạp hàng loạt từ file DAT hoặc học phí.

   @Json: [{"Cccd":"…","HoTen":"…","KhoaGoc":"…","TrangThai":"DU","GhiChu":"…"}, …]
   Khớp người theo CCCD trước, không có thì theo họ tên + mã khóa cũ, và chỉ
   trong phạm vi một đợt. Dòng nào không khớp thì trả về để cán bộ xem, KHÔNG
   đoán bừa — nạp nhầm học phí cho người khác là chuyện không sửa lại được
   bằng mắt thường.                                                          */
CREATE OR ALTER PROCEDURE dbo.sp_NapHoSoHangLoat
  @Json        nvarchar(max),
  @DotId       int,
  @MaMuc       varchar(24),
  @Nguon       varchar(30),
  @MoTa        nvarchar(300) = NULL,
  @NguoiDungId int = NULL,
  @LanDongBoId int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @MucId int = (SELECT MucId FROM dbo.MucKiemTra WHERE Ma = @MaMuc);
  IF @MucId IS NULL THROW 50021, N'Mục kiểm tra không tồn tại.', 1;

  /* HoTen phải khai đúng collation của cột DangKyGhepKhoa.HoTenKhai. Để mặc
     định thì phép so sánh `=` giữa hai collation khác nhau bị SQL từ chối. */
  DECLARE @v TABLE (
    Dong      int IDENTITY(1,1),
    Cccd      varchar(12),
    HoTen     nvarchar(120) COLLATE Vietnamese_CI_AS,
    KhoaGoc   varchar(20),
    TrangThai varchar(12),
    GhiChu    nvarchar(300),
    DangKyId  int NULL
  );
  INSERT @v (Cccd, HoTen, KhoaGoc, TrangThai, GhiChu)
  SELECT NULLIF(Cccd, ''), UPPER(LTRIM(RTRIM(HoTen))), UPPER(REPLACE(KhoaGoc, ' ', '')),
         ISNULL(NULLIF(TrangThai, ''), 'DU'), NULLIF(LTRIM(RTRIM(GhiChu)), N'')
    FROM OPENJSON(@Json) WITH (
      Cccd      varchar(12)   '$.Cccd',
      HoTen     nvarchar(120) '$.HoTen',
      KhoaGoc   varchar(20)   '$.KhoaGoc',
      TrangThai varchar(12)   '$.TrangThai',
      GhiChu    nvarchar(300) '$.GhiChu'
    );

  IF EXISTS (SELECT 1 FROM @v WHERE TrangThai NOT IN ('DU','THIEU','KHONG_CAN'))
    THROW 50022, N'Trạng thái trong file không hợp lệ (chỉ nhận DU, THIEU, KHONG_CAN).', 1;

  /* 1 — khớp theo CCCD */
  UPDATE v SET DangKyId = k.DangKyId
    FROM @v v
    JOIN dbo.DangKyGhepKhoa k
      ON k.DotId = @DotId AND k.CccdKhai = v.Cccd
   WHERE v.Cccd IS NOT NULL;

  /* 2 — chưa khớp thì theo tên + khóa cũ, và chỉ nhận khi duy nhất */
  UPDATE v SET DangKyId = x.DangKyId
    FROM @v v
   CROSS APPLY (
      SELECT MIN(k.DangKyId) AS DangKyId
        FROM dbo.DangKyGhepKhoa k
       WHERE k.DotId = @DotId AND k.HoTenKhai = v.HoTen
         AND (v.KhoaGoc IS NULL OR v.KhoaGoc = '' OR k.MaKhoaGocKhai = v.KhoaGoc)
      HAVING COUNT(*) = 1
   ) x
   WHERE v.DangKyId IS NULL;

  BEGIN TRAN;
    INSERT dbo.LanDongBo (Nguon, MoTa, SoBanGhi, NguoiDungId)
    VALUES (@Nguon, @MoTa, (SELECT COUNT(*) FROM @v WHERE DangKyId IS NOT NULL), @NguoiDungId);
    SET @LanDongBoId = SCOPE_IDENTITY();

    MERGE dbo.TinhTrangHoSo AS t
    USING (SELECT DISTINCT DangKyId, TrangThai, GhiChu FROM @v WHERE DangKyId IS NOT NULL) AS n
       ON t.DangKyId = n.DangKyId AND t.MucId = @MucId
    WHEN MATCHED THEN UPDATE SET
        TrangThai = n.TrangThai, GhiChu = n.GhiChu,
        LanDongBoId = @LanDongBoId, NguoiCapNhatId = @NguoiDungId,
        CapNhatLuc = SYSDATETIMEOFFSET()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (DangKyId, MucId, TrangThai, GhiChu, LanDongBoId, NguoiCapNhatId)
        VALUES (n.DangKyId, @MucId, n.TrangThai, n.GhiChu, @LanDongBoId, @NguoiDungId);
  COMMIT TRAN;

  /* Trả về những dòng không khớp để cán bộ tự xử */
  SELECT Dong, Cccd, HoTen, KhoaGoc FROM @v WHERE DangKyId IS NULL ORDER BY Dong;
END
GO

PRINT N'006_cap_nhat_ho_so.sql — xong.';
GO
