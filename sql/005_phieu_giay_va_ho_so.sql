/* ============================================================================
   1. Nới ràng buộc phiếu đăng ký cho khớp phiếu giấy đang dùng.
   2. Thêm phần theo dõi hồ sơ: DAT, học phí, giấy khám sức khỏe, photo CCCD,
      dấu cũ — đây là sổ sách nội bộ của trung tâm, hệ thống GPLX quốc gia
      không có, nên phải tự giữ ở database này.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

/* ---------------------------------------------- 1. Nới phiếu đăng ký ------
   Phiếu giấy chỉ ghi: họ tên, khóa cũ, ngày muốn ghép. Ngày sinh thường bỏ
   trống vì đã có trong hồ sơ khóa cũ; CCCD và số điện thoại thì không có.
   Bắt buộc mấy trường đó thì cán bộ cầm phiếu giấy không nhập được.        */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DK_Cccd')
  ALTER TABLE dbo.DangKyGhepKhoa DROP CONSTRAINT CK_DK_Cccd;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DK_Sdt')
  ALTER TABLE dbo.DangKyGhepKhoa DROP CONSTRAINT CK_DK_Sdt;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DK_NgaySinh')
  ALTER TABLE dbo.DangKyGhepKhoa DROP CONSTRAINT CK_DK_NgaySinh;
GO

/* Khóa chống trùng cũ là UNIQUE (DotId, CccdKhai). CCCD cho phép trống thì nó
   vô hiệu, phải thay bằng hai chỉ mục: một cái theo CCCD nhưng chỉ áp dụng khi
   có CCCD, một cái theo tên + khóa cũ cho trường hợp không có CCCD.          */
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_DK_Dot_Cccd')
  ALTER TABLE dbo.DangKyGhepKhoa DROP CONSTRAINT UQ_DK_Dot_Cccd;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_DK_Dot_Cccd' AND object_id = OBJECT_ID('dbo.DangKyGhepKhoa'))
  DROP INDEX UX_DK_Dot_Cccd ON dbo.DangKyGhepKhoa;
GO

ALTER TABLE dbo.DangKyGhepKhoa ALTER COLUMN CccdKhai     varchar(12) NULL;
GO
ALTER TABLE dbo.DangKyGhepKhoa ALTER COLUMN SoDienThoai  varchar(15) NULL;
GO
ALTER TABLE dbo.DangKyGhepKhoa ALTER COLUMN NgaySinhKhai date        NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DK_Cccd')
  ALTER TABLE dbo.DangKyGhepKhoa ADD CONSTRAINT CK_DK_Cccd
    CHECK (CccdKhai IS NULL OR (LEN(CccdKhai) = 12 AND CccdKhai NOT LIKE '%[^0-9]%'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DK_Sdt')
  ALTER TABLE dbo.DangKyGhepKhoa ADD CONSTRAINT CK_DK_Sdt
    CHECK (SoDienThoai IS NULL OR
           (SoDienThoai NOT LIKE '%[^0-9]%' AND LEN(SoDienThoai) BETWEEN 9 AND 15));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DK_NgaySinh')
  ALTER TABLE dbo.DangKyGhepKhoa ADD CONSTRAINT CK_DK_NgaySinh
    CHECK (NgaySinhKhai IS NULL OR NgaySinhKhai BETWEEN '1930-01-01' AND '2020-12-31');
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_DK_Dot_Cccd')
  CREATE UNIQUE INDEX UX_DK_Dot_Cccd ON dbo.DangKyGhepKhoa (DotId, CccdKhai)
    WHERE CccdKhai IS NOT NULL;
GO
/* Cùng một người, cùng một khóa cũ, cùng một đợt thì chỉ được một phiếu.
   Chỉ mục này so tên có dấu, nên gõ thiếu dấu vẫn lọt — chấp nhận được vì
   form đã chuẩn hóa chữ hoa và cán bộ gõ tiếng Việt có dấu.                 */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_DK_Dot_Ten_Khoa')
  CREATE UNIQUE INDEX UX_DK_Dot_Ten_Khoa
    ON dbo.DangKyGhepKhoa (DotId, HoTenKhai, MaKhoaGocKhai);
GO

/* --------------------------------------------- 2. Lần đồng bộ dữ liệu -----
   Mỗi lần nạp dữ liệu từ ngoài vào (file Excel học phí, kết xuất DAT, nhập
   tay…) ghi lại một dòng. Nhờ đó màn hình nói được "dữ liệu tính đến lúc
   nào" — học viên vừa đóng tiền sáng nay mà bản nạp là từ hôm qua thì phải
   cho người ta thấy, không thì họ tưởng mình bị ghi nhận sai.               */
IF OBJECT_ID('dbo.LanDongBo', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.LanDongBo (
    LanDongBoId  int IDENTITY(1,1) NOT NULL,
    Nguon        varchar(30)       NOT NULL,
    MoTa         nvarchar(300)     NULL,
    ThoiDiem     datetimeoffset(0) NOT NULL CONSTRAINT DF_LDB_ThoiDiem DEFAULT (SYSDATETIMEOFFSET()),
    SoBanGhi     int               NULL,
    NguoiDungId  int               NULL,
    CONSTRAINT PK_LanDongBo    PRIMARY KEY (LanDongBoId),
    CONSTRAINT FK_LDB_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES dbo.NguoiDung (NguoiDungId),
    CONSTRAINT CK_LDB_Nguon    CHECK (Nguon IN ('DAT', 'HOC_PHI', 'HO_SO', 'GPLX_DB', 'BAO_CAO_1', 'NHAP_TAY'))
  );
  CREATE INDEX IX_LDB_Nguon ON dbo.LanDongBo (Nguon, ThoiDiem DESC);
END
GO

/* ------------------------------------------- 3. Danh mục mục kiểm tra ----- */
IF OBJECT_ID('dbo.MucKiemTra', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MucKiemTra (
    MucId        int IDENTITY(1,1) NOT NULL,
    Ma           varchar(24)       NOT NULL,
    Ten          nvarchar(120)     NOT NULL,
    MoTaChoHocVien nvarchar(300)   NULL,
    Nguon        varchar(30)       NOT NULL,
    ThuTu        smallint          NOT NULL,
    /* Có mục chỉ cần khi nâng hạng, ví dụ dấu cũ: người đã có bằng C muốn
       lên D2 mới phải nộp, người học mới thì không.                          */
    ChiKhiNangHang bit             NOT NULL CONSTRAINT DF_MKT_NangHang DEFAULT (0),
    DangSuDung   bit               NOT NULL CONSTRAINT DF_MKT_SuDung   DEFAULT (1),
    CONSTRAINT PK_MucKiemTra    PRIMARY KEY (MucId),
    CONSTRAINT UQ_MucKiemTra_Ma UNIQUE (Ma),
    CONSTRAINT CK_MKT_Nguon     CHECK (Nguon IN ('DAT', 'HOC_PHI', 'HO_SO', 'GPLX_DB', 'NHAP_TAY'))
  );
END
GO

MERGE dbo.MucKiemTra AS t
USING (VALUES
  ('DAT',        N'Dữ liệu DAT',              N'Dữ liệu giám sát thời gian và quãng đường học thực hành. Thiếu thì phải học bù cho đủ.',            'DAT',     10, 0),
  ('HOC_PHI',    N'Học phí',                  N'Đóng đủ học phí tại phòng kế toán của trung tâm.',                                                  'HOC_PHI', 20, 0),
  ('KHAM_SUC_KHOE', N'Giấy khám sức khỏe',    N'Giấy khám sức khỏe do cơ sở y tế có thẩm quyền cấp, còn trong thời hạn.',                           'HO_SO',   30, 0),
  ('PHOTO_CCCD', N'Bản photo căn cước',       N'Bản chụp căn cước công dân còn hạn.',                                                               'HO_SO',   40, 0),
  ('DAU_CU',     N'Dấu cũ (giấy phép đã có)', N'Chỉ áp dụng khi nâng hạng: nộp bản chụp giấy phép lái xe đang có, ví dụ có hạng C muốn lên D2.',     'HO_SO',   50, 1)
) AS n (Ma, Ten, MoTaChoHocVien, Nguon, ThuTu, ChiKhiNangHang)
  ON t.Ma = n.Ma
WHEN MATCHED THEN UPDATE SET
  t.Ten = n.Ten, t.MoTaChoHocVien = n.MoTaChoHocVien, t.Nguon = n.Nguon,
  t.ThuTu = n.ThuTu, t.ChiKhiNangHang = n.ChiKhiNangHang
WHEN NOT MATCHED THEN INSERT (Ma, Ten, MoTaChoHocVien, Nguon, ThuTu, ChiKhiNangHang)
  VALUES (n.Ma, n.Ten, n.MoTaChoHocVien, n.Nguon, n.ThuTu, n.ChiKhiNangHang);
GO

/* ------------------------------------ 4. Tình trạng từng mục của mỗi phiếu -
   Không lưu dòng cho mục còn thiếu cũng được, nhưng lưu tường minh thì mới
   phân biệt được "chưa ai kiểm" với "đã kiểm và thiếu" — hai chuyện khác hẳn
   nhau khi trả lời học viên.                                                */
IF OBJECT_ID('dbo.TinhTrangHoSo', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TinhTrangHoSo (
    DangKyId      int               NOT NULL,
    MucId         int               NOT NULL,
    TrangThai     varchar(12)       NOT NULL,
    GhiChu        nvarchar(300)     NULL,
    LanDongBoId   int               NULL,
    NguoiCapNhatId int              NULL,
    CapNhatLuc    datetimeoffset(0) NOT NULL CONSTRAINT DF_TTHS_CapNhat DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_TinhTrangHoSo  PRIMARY KEY (DangKyId, MucId),
    CONSTRAINT FK_TTHS_DangKy    FOREIGN KEY (DangKyId)  REFERENCES dbo.DangKyGhepKhoa (DangKyId) ON DELETE CASCADE,
    CONSTRAINT FK_TTHS_Muc       FOREIGN KEY (MucId)     REFERENCES dbo.MucKiemTra (MucId),
    CONSTRAINT FK_TTHS_LanDongBo FOREIGN KEY (LanDongBoId) REFERENCES dbo.LanDongBo (LanDongBoId),
    CONSTRAINT FK_TTHS_NguoiCN   FOREIGN KEY (NguoiCapNhatId) REFERENCES dbo.NguoiDung (NguoiDungId),
    CONSTRAINT CK_TTHS_TrangThai CHECK (TrangThai IN ('DU', 'THIEU', 'KHONG_CAN'))
  );
  CREATE INDEX IX_TTHS_Muc ON dbo.TinhTrangHoSo (MucId, TrangThai);
END
GO

/* -------------------------------------------------------------- 5. View --- */

/* Mỗi phiếu × mỗi mục kiểm tra, kèm trạng thái và thời điểm dữ liệu.
   Mục chưa ai đụng tới thì hiện CHUA_KIEM chứ không phải THIEU.             */
CREATE OR ALTER VIEW dbo.vw_HoSoTungMuc AS
SELECT
  k.DangKyId, k.DotId, k.HoTenKhai, k.MaKhoaGocKhai,
  m.MucId, m.Ma AS MaMuc, m.Ten AS TenMuc, m.MoTaChoHocVien, m.ThuTu, m.Nguon,
  m.ChiKhiNangHang,
  TrangThai = CASE
      /* Dấu cũ chỉ hỏi khi người đó thật sự đã có giấy phép lái xe */
      WHEN m.ChiKhiNangHang = 1 AND ISNULL(hv.SoGplxDaCo, '') = '' THEN 'KHONG_CAN'
      ELSE ISNULL(t.TrangThai, 'CHUA_KIEM') END,
  t.GhiChu,
  CapNhatLuc  = t.CapNhatLuc,
  DuLieuTinhDen = ISNULL(ldb.ThoiDiem, t.CapNhatLuc),
  NguonDuLieu = ldb.Nguon,
  NguoiCapNhat = nd.HoTen
FROM dbo.DangKyGhepKhoa k
CROSS JOIN dbo.MucKiemTra m
LEFT JOIN dbo.TinhTrangHoSo t ON t.DangKyId = k.DangKyId AND t.MucId = m.MucId
LEFT JOIN dbo.LanDongBo ldb   ON ldb.LanDongBoId = t.LanDongBoId
LEFT JOIN dbo.NguoiDung nd    ON nd.NguoiDungId = t.NguoiCapNhatId
LEFT JOIN dbo.vw_DangKy hv    ON hv.DangKyId = k.DangKyId
WHERE m.DangSuDung = 1;
GO

/* Gộp về một dòng cho mỗi phiếu: thiếu mấy mục, thiếu những gì. */
CREATE OR ALTER VIEW dbo.vw_HoSoTomTat AS
SELECT
  DangKyId,
  SoMucCanCo  = SUM(CASE WHEN TrangThai <> 'KHONG_CAN' THEN 1 ELSE 0 END),
  SoDu        = SUM(CASE WHEN TrangThai = 'DU'        THEN 1 ELSE 0 END),
  SoThieu     = SUM(CASE WHEN TrangThai = 'THIEU'     THEN 1 ELSE 0 END),
  SoChuaKiem  = SUM(CASE WHEN TrangThai = 'CHUA_KIEM' THEN 1 ELSE 0 END),
  TenMucThieu = STRING_AGG(CASE WHEN TrangThai = 'THIEU' THEN TenMuc END, N', ')
                  WITHIN GROUP (ORDER BY ThuTu),
  DuLieuTinhDen = MAX(DuLieuTinhDen)
FROM dbo.vw_HoSoTungMuc
GROUP BY DangKyId;
GO

/* Lần đồng bộ gần nhất theo từng nguồn — để hiện dòng "dữ liệu tính đến…" */
CREATE OR ALTER VIEW dbo.vw_DongBoGanNhat AS
SELECT Nguon, ThoiDiem, MoTa, SoBanGhi
FROM (
  SELECT Nguon, ThoiDiem, MoTa, SoBanGhi,
         hang = ROW_NUMBER() OVER (PARTITION BY Nguon ORDER BY ThoiDiem DESC, LanDongBoId DESC)
  FROM dbo.LanDongBo
) x WHERE hang = 1;
GO

PRINT N'005_phieu_giay_va_ho_so.sql — xong.';
GO
