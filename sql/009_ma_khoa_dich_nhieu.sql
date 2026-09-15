/* ============================================================================
   Một đợt ghép khóa có thể khai NHIỀU mã khóa đích (ví dụ gộp chung một buổi
   thi cho vài lớp khác nhau). DotGhepKhoa.MaKhoaDich vẫn giữ nguyên là MỘT
   mã "chính" (mã đầu tiên khai) — mọi chỗ đang dùng nó để in tiêu đề/đặt tên
   file/hiển thị trên lịch không phải sửa gì. Bảng này chỉ cộng thêm, dùng để
   kiểm tra lúc đăng ký: "Khóa cũ" trùng với BẤT KỲ mã khóa đích nào của đợt
   thì chặn — ghép một khóa vào chính nó là vô lý.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.DotMaKhoaDich', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DotMaKhoaDich (
    DotId       int         NOT NULL,
    MaKhoaDich  varchar(20) NOT NULL,
    CONSTRAINT PK_DotMaKhoaDich PRIMARY KEY (DotId, MaKhoaDich),
    CONSTRAINT FK_DotMaKhoaDich_Dot FOREIGN KEY (DotId)
      REFERENCES dbo.DotGhepKhoa (DotId) ON DELETE CASCADE,
    CONSTRAINT CK_DotMaKhoaDich_Ma CHECK (MaKhoaDich LIKE '%K[0-9]%' AND MaKhoaDich = UPPER(MaKhoaDich))
  );

  -- Đợt đã có sẵn từ trước migration này thì mã chính coi như mã duy nhất.
  INSERT dbo.DotMaKhoaDich (DotId, MaKhoaDich)
  SELECT DotId, MaKhoaDich FROM dbo.DotGhepKhoa;
END
GO

PRINT N'009_ma_khoa_dich_nhieu.sql — xong.';
GO
