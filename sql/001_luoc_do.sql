/* ============================================================================
   DrivingManagement — lược đồ chính
   Chạy được nhiều lần, không hỏng dữ liệu đã có.

   Ghi chú về collation: database đang dùng SQL_Latin1_General_CP1_CI_AS nên
   mọi cột chữ tiếng Việt đều là NVARCHAR; riêng các cột dùng để tìm kiếm và
   sắp xếp theo tên người thì ép COLLATE Vietnamese_CI_AS để "Sang" đứng trước
   "Sáng" và "Đăng" đứng trước "Danh" cho đúng.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------- ĐƠN VỊ --
   Hai pháp nhân cùng tổ chức thi: Trường Cao đẳng Tây Đô (mã cơ sở 92001) và
   Trung tâm GDNN ĐT&SH LX CG ĐB Tây Đô (92004). Mã cơ sở chính là tiền tố
   trong mã học viên, ví dụ 92001-20260408-114819-C1/92001.
   Mỗi đơn vị có mẫu văn bản, chức danh và người ký riêng.                    */
IF OBJECT_ID('dbo.DonVi', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DonVi (
    DonViId          int IDENTITY(1,1)  NOT NULL,
    MaCoSo           varchar(10)        NOT NULL,
    LoaiDonVi        varchar(12)        NOT NULL,
    TenDayDu         nvarchar(200)      NOT NULL,
    TenVietTat       nvarchar(60)       NOT NULL,
    TenTrenVanBan    nvarchar(120)      NOT NULL,
    CoQuanChuQuan    nvarchar(200)      NULL,
    ChucDanhKy       nvarchar(80)       NULL,
    ChucDanhPhu      nvarchar(80)       NULL,
    NguoiKy          nvarchar(120)      NULL,
    MauVanBan        nvarchar(400)      NULL,
    DangHoatDong     bit                NOT NULL CONSTRAINT DF_DonVi_HoatDong   DEFAULT (1),
    TaoLuc           datetimeoffset(0)  NOT NULL CONSTRAINT DF_DonVi_TaoLuc     DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc       datetimeoffset(0)  NOT NULL CONSTRAINT DF_DonVi_CapNhatLuc DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_DonVi          PRIMARY KEY (DonViId),
    CONSTRAINT UQ_DonVi_MaCoSo   UNIQUE (MaCoSo),
    CONSTRAINT CK_DonVi_Loai     CHECK (LoaiDonVi IN ('TRUONG', 'TRUNG_TAM')),
    CONSTRAINT CK_DonVi_MaCoSo   CHECK (MaCoSo NOT LIKE '%[^0-9]%' AND LEN(MaCoSo) BETWEEN 4 AND 10)
  );
END
GO

/* ------------------------------------------------------------ HẠNG GPLX --
   ThuTu quyết định thứ tự các nhóm khóa khi in danh sách dự thi. Bản mẫu
   C1K82 xếp B → C1 → B-D2 → CE, không phải thứ tự chữ cái, nên phải lưu
   tường minh chứ không suy ra được.                                          */
IF OBJECT_ID('dbo.HangGPLX', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HangGPLX (
    HangMa       varchar(10)   NOT NULL,
    TenHang      nvarchar(120) NOT NULL,
    ThuTu        smallint      NOT NULL,
    DangSuDung   bit           NOT NULL CONSTRAINT DF_Hang_SuDung DEFAULT (1),
    CONSTRAINT PK_HangGPLX       PRIMARY KEY (HangMa),
    CONSTRAINT UQ_HangGPLX_ThuTu UNIQUE (ThuTu),
    CONSTRAINT CK_HangGPLX_Ma    CHECK (HangMa = UPPER(HangMa) AND HangMa NOT LIKE '%[^A-Z0-9-]%')
  );
END
GO

/* ------------------------------------------------------------------ KHÓA --
   Một khóa đào tạo của một đơn vị. MaKhoa (C1K52, BK134, B-D2K247) được tính
   sẵn và lưu lại để đối chiếu với dữ liệu người đăng ký tự khai.             */
IF OBJECT_ID('dbo.Khoa', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Khoa (
    KhoaId          int IDENTITY(1,1) NOT NULL,
    DonViId         int               NOT NULL,
    HangMa          varchar(10)       NOT NULL,
    SoKhoa          smallint          NOT NULL,
    MaKhoa          AS (UPPER(HangMa) + 'K' + CONVERT(varchar(6), SoKhoa)) PERSISTED NOT NULL,
    NgayKhaiGiang   date              NULL,
    NgayBeGiang     date              NULL,
    SoNgayDaoTao    smallint          NULL,
    SoVanBan        nvarchar(60)      NULL,
    TrangThai       varchar(16)       NOT NULL CONSTRAINT DF_Khoa_TrangThai DEFAULT ('DANG_HOC'),
    NguonNhap       nvarchar(260)     NULL,
    TaoLuc          datetimeoffset(0) NOT NULL CONSTRAINT DF_Khoa_TaoLuc     DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc      datetimeoffset(0) NOT NULL CONSTRAINT DF_Khoa_CapNhatLuc DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_Khoa             PRIMARY KEY (KhoaId),
    CONSTRAINT UQ_Khoa_DonVi_Ma    UNIQUE (DonViId, MaKhoa),
    CONSTRAINT FK_Khoa_DonVi       FOREIGN KEY (DonViId) REFERENCES dbo.DonVi (DonViId),
    CONSTRAINT FK_Khoa_Hang        FOREIGN KEY (HangMa)  REFERENCES dbo.HangGPLX (HangMa),
    CONSTRAINT CK_Khoa_SoKhoa      CHECK (SoKhoa BETWEEN 1 AND 9999),
    CONSTRAINT CK_Khoa_TrangThai   CHECK (TrangThai IN ('DANG_HOC', 'CHO_THI', 'DA_THI', 'KET_THUC')),
    CONSTRAINT CK_Khoa_Ngay        CHECK (NgayBeGiang IS NULL OR NgayKhaiGiang IS NULL
                                          OR NgayBeGiang >= NgayKhaiGiang)
  );
  CREATE INDEX IX_Khoa_DonVi ON dbo.Khoa (DonViId, TrangThai) INCLUDE (MaKhoa);
  CREATE INDEX IX_Khoa_MaKhoa ON dbo.Khoa (MaKhoa);
END
GO

/* -------------------------------------------------------------- HỌC VIÊN --
   Một con người, định danh bằng CCCD. Tách khỏi bảng ghi danh vì cùng một
   người có thể học nhiều khóa (học C1 rồi học nâng hạng), và vì người đó có
   thể xuất hiện ở cả hai đơn vị.                                             */
IF OBJECT_ID('dbo.HocVien', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HocVien (
    HocVienId     int IDENTITY(1,1) NOT NULL,
    Cccd          varchar(12)       NOT NULL,
    HoTen         nvarchar(120) COLLATE Vietnamese_CI_AS NOT NULL,
    NgaySinh      date              NULL,
    NoiThuongTru  nvarchar(400) COLLATE Vietnamese_CI_AS NULL,
    SoDienThoai   varchar(15)       NULL,
    SoGplxDaCo    varchar(20)       NULL,
    HangGplxDaCo  nvarchar(10)      NULL,
    TaoLuc        datetimeoffset(0) NOT NULL CONSTRAINT DF_HocVien_TaoLuc     DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc    datetimeoffset(0) NOT NULL CONSTRAINT DF_HocVien_CapNhatLuc DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_HocVien      PRIMARY KEY (HocVienId),
    CONSTRAINT UQ_HocVien_Cccd UNIQUE (Cccd),
    CONSTRAINT CK_HocVien_Cccd CHECK (LEN(Cccd) = 12 AND Cccd NOT LIKE '%[^0-9]%'),
    CONSTRAINT CK_HocVien_Sdt  CHECK (SoDienThoai IS NULL OR
                                      (SoDienThoai NOT LIKE '%[^0-9]%' AND LEN(SoDienThoai) BETWEEN 9 AND 15)),
    CONSTRAINT CK_HocVien_Sinh CHECK (NgaySinh IS NULL OR NgaySinh BETWEEN '1930-01-01' AND '2020-12-31')
  );
  CREATE INDEX IX_HocVien_HoTen ON dbo.HocVien (HoTen, NgaySinh);
END
GO

/* --------------------------------------------------------- HỌC VIÊN–KHÓA --
   Việc một học viên theo học một khóa, kèm mã học viên do hệ thống cấp và
   kết quả tốt nghiệp của khóa đó. Đây là bảng script Python đối chiếu vào.   */
IF OBJECT_ID('dbo.HocVienKhoa', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HocVienKhoa (
    HocVienKhoaId  int IDENTITY(1,1) NOT NULL,
    KhoaId         int               NOT NULL,
    HocVienId      int               NOT NULL,
    SoThuTu        smallint          NULL,
    MaHocVien      varchar(60)       NULL,
    KetQuaTotNghiep varchar(12)      NOT NULL CONSTRAINT DF_HVK_KetQua DEFAULT ('CHUA_THI'),
    KhoaGhepToiId  int               NULL,
    NgayCoKetQua   date              NULL,
    GhiChu         nvarchar(200)     NULL,
    TaoLuc         datetimeoffset(0) NOT NULL CONSTRAINT DF_HVK_TaoLuc     DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc     datetimeoffset(0) NOT NULL CONSTRAINT DF_HVK_CapNhatLuc DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_HocVienKhoa        PRIMARY KEY (HocVienKhoaId),
    CONSTRAINT UQ_HVK_Khoa_HocVien   UNIQUE (KhoaId, HocVienId),
    CONSTRAINT FK_HVK_Khoa           FOREIGN KEY (KhoaId)        REFERENCES dbo.Khoa (KhoaId) ON DELETE CASCADE,
    CONSTRAINT FK_HVK_HocVien        FOREIGN KEY (HocVienId)     REFERENCES dbo.HocVien (HocVienId),
    CONSTRAINT FK_HVK_KhoaGhepToi    FOREIGN KEY (KhoaGhepToiId) REFERENCES dbo.Khoa (KhoaId),
    CONSTRAINT CK_HVK_KetQua         CHECK (KetQuaTotNghiep IN ('CHUA_THI', 'DAT', 'VANG_THI', 'TRUOT')),
    /* đã đạt thì không còn lý do ghép sang khóa khác */
    CONSTRAINT CK_HVK_DatThiKhongGhep CHECK (KetQuaTotNghiep <> 'DAT' OR KhoaGhepToiId IS NULL)
  );
  CREATE UNIQUE INDEX UX_HVK_MaHocVien ON dbo.HocVienKhoa (MaHocVien) WHERE MaHocVien IS NOT NULL;
  CREATE INDEX IX_HVK_HocVien   ON dbo.HocVienKhoa (HocVienId);
  CREATE INDEX IX_HVK_ChoGhep   ON dbo.HocVienKhoa (KhoaGhepToiId) WHERE KhoaGhepToiId IS NOT NULL;
END
GO

/* ------------------------------------------------------------ ĐỢT GHÉP --
   Một buổi thi tốt nghiệp mà học viên khóa cũ được ghép vào. Thuộc về một
   đơn vị: đợt của Trường thì học viên Trung tâm không đăng ký được.          */
IF OBJECT_ID('dbo.DotGhepKhoa', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DotGhepKhoa (
    DotId          int IDENTITY(1,1) NOT NULL,
    DonViId        int               NOT NULL,
    MaKhoaDich     varchar(20)       NOT NULL,
    KhoaDichId     int               NULL,
    Ten            nvarchar(160)     NOT NULL,
    NgayThi        date              NOT NULL,
    HanDangKy      date              NULL,
    SoLuongToiDa   smallint          NULL,
    DiaDiemThi     nvarchar(200)     NULL,
    DangMo         bit               NOT NULL CONSTRAINT DF_Dot_DangMo DEFAULT (1),
    TrangThai      varchar(12)       NOT NULL CONSTRAINT DF_Dot_TrangThai DEFAULT ('MO'),
    TaoLuc         datetimeoffset(0) NOT NULL CONSTRAINT DF_Dot_TaoLuc     DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc     datetimeoffset(0) NOT NULL CONSTRAINT DF_Dot_CapNhatLuc DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_DotGhepKhoa      PRIMARY KEY (DotId),
    CONSTRAINT UQ_Dot_DonVi_Ma_Ngay UNIQUE (DonViId, MaKhoaDich, NgayThi),
    CONSTRAINT FK_Dot_DonVi        FOREIGN KEY (DonViId)    REFERENCES dbo.DonVi (DonViId),
    CONSTRAINT FK_Dot_KhoaDich     FOREIGN KEY (KhoaDichId) REFERENCES dbo.Khoa (KhoaId),
    CONSTRAINT CK_Dot_MaKhoaDich   CHECK (MaKhoaDich LIKE '%K[0-9]%' AND MaKhoaDich = UPPER(MaKhoaDich)),
    CONSTRAINT CK_Dot_TrangThai    CHECK (TrangThai IN ('MO', 'DONG', 'DA_THI', 'HUY')),
    CONSTRAINT CK_Dot_SoLuong      CHECK (SoLuongToiDa IS NULL OR SoLuongToiDa > 0),
    CONSTRAINT CK_Dot_HanDangKy    CHECK (HanDangKy IS NULL OR HanDangKy <= NgayThi)
  );
  CREATE INDEX IX_Dot_DonVi_Mo ON dbo.DotGhepKhoa (DonViId, DangMo, NgayThi);
END
GO

/* ------------------------------------------------------- ĐĂNG KÝ GHÉP KHÓA --
   Nguyện vọng do học viên tự khai trên web. Cố ý lưu nguyên văn những gì họ
   gõ (HoTenKhai, MaKhoaGocKhai...) và tách riêng HocVienId là kết quả đối
   chiếu của cán bộ — để về sau còn truy được người đó khai sai chỗ nào.      */
IF OBJECT_ID('dbo.DangKyGhepKhoa', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DangKyGhepKhoa (
    DangKyId       int IDENTITY(1,1) NOT NULL,
    DotId          int               NOT NULL,
    HoTenKhai      nvarchar(120) COLLATE Vietnamese_CI_AS NOT NULL,
    NgaySinhKhai   date              NOT NULL,
    CccdKhai       varchar(12)       NOT NULL,
    DiaChiKhai     nvarchar(400) COLLATE Vietnamese_CI_AS NULL,
    MaKhoaGocKhai  varchar(20)       NOT NULL,
    SoDienThoai    varchar(15)       NOT NULL,
    GhiChuKhai     nvarchar(300)     NULL,

    HocVienKhoaId  int               NULL,   -- khớp được vào hồ sơ nào
    CachKhop       varchar(16)       NULL,   -- CCCD | TEN_NGAYSINH | THU_CONG

    TrangThai      varchar(12)       NOT NULL CONSTRAINT DF_DK_TrangThai DEFAULT ('CHO_DUYET'),
    LyDoTuChoi     nvarchar(300)     NULL,
    NguoiDuyetId   int               NULL,
    DuyetLuc       datetimeoffset(0) NULL,

    DiaChiIp       varchar(45)       NULL,
    TaoLuc         datetimeoffset(0) NOT NULL CONSTRAINT DF_DK_TaoLuc     DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc     datetimeoffset(0) NOT NULL CONSTRAINT DF_DK_CapNhatLuc DEFAULT (SYSDATETIMEOFFSET()),
    Phien          rowversion        NOT NULL,

    CONSTRAINT PK_DangKyGhepKhoa   PRIMARY KEY (DangKyId),
    CONSTRAINT UQ_DK_Dot_Cccd      UNIQUE (DotId, CccdKhai),
    CONSTRAINT FK_DK_Dot           FOREIGN KEY (DotId)         REFERENCES dbo.DotGhepKhoa (DotId) ON DELETE CASCADE,
    CONSTRAINT FK_DK_HocVienKhoa   FOREIGN KEY (HocVienKhoaId) REFERENCES dbo.HocVienKhoa (HocVienKhoaId),
    CONSTRAINT CK_DK_Cccd          CHECK (LEN(CccdKhai) = 12 AND CccdKhai NOT LIKE '%[^0-9]%'),
    CONSTRAINT CK_DK_Sdt           CHECK (SoDienThoai NOT LIKE '%[^0-9]%' AND LEN(SoDienThoai) BETWEEN 9 AND 15),
    CONSTRAINT CK_DK_MaKhoaGoc     CHECK (MaKhoaGocKhai LIKE '%K[0-9]%' AND MaKhoaGocKhai = UPPER(MaKhoaGocKhai)),
    CONSTRAINT CK_DK_TrangThai     CHECK (TrangThai IN ('CHO_DUYET', 'DUYET', 'TU_CHOI')),
    CONSTRAINT CK_DK_CachKhop      CHECK (CachKhop IS NULL OR CachKhop IN ('CCCD', 'TEN_NGAYSINH', 'THU_CONG')),
    /* đã duyệt thì bắt buộc phải khớp được vào một hồ sơ có thật */
    CONSTRAINT CK_DK_DuyetPhaiKhop CHECK (TrangThai <> 'DUYET' OR HocVienKhoaId IS NOT NULL),
    /* trả lại thì phải nêu lý do, để học viên còn biết đường bổ sung */
    CONSTRAINT CK_DK_TuChoiCoLyDo  CHECK (TrangThai <> 'TU_CHOI' OR LyDoTuChoi IS NOT NULL),
    CONSTRAINT CK_DK_NgaySinh      CHECK (NgaySinhKhai BETWEEN '1930-01-01' AND '2020-12-31')
  );
  CREATE INDEX IX_DK_Dot_TrangThai ON dbo.DangKyGhepKhoa (DotId, TrangThai);
  CREATE INDEX IX_DK_Cccd          ON dbo.DangKyGhepKhoa (CccdKhai);
END
GO

/* -------------------------------------------------------------- NGƯỜI DÙNG --
   Tài khoản cán bộ. DonViId NULL nghĩa là quản trị toàn hệ thống, thấy cả
   hai đơn vị; có DonViId thì chỉ thấy đợt và đăng ký của đơn vị mình.        */
IF OBJECT_ID('dbo.NguoiDung', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.NguoiDung (
    NguoiDungId   int IDENTITY(1,1) NOT NULL,
    TenDangNhap   varchar(60)       NOT NULL,
    HoTen         nvarchar(120) COLLATE Vietnamese_CI_AS NOT NULL,
    MatKhauHash   varchar(255)      NOT NULL,
    VaiTro        varchar(12)       NOT NULL,
    DonViId       int               NULL,
    DangHoatDong  bit               NOT NULL CONSTRAINT DF_ND_HoatDong DEFAULT (1),
    LanDangNhapCuoi datetimeoffset(0) NULL,
    TaoLuc        datetimeoffset(0) NOT NULL CONSTRAINT DF_ND_TaoLuc     DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc    datetimeoffset(0) NOT NULL CONSTRAINT DF_ND_CapNhatLuc DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_NguoiDung        PRIMARY KEY (NguoiDungId),
    CONSTRAINT UQ_ND_TenDangNhap   UNIQUE (TenDangNhap),
    CONSTRAINT FK_ND_DonVi         FOREIGN KEY (DonViId) REFERENCES dbo.DonVi (DonViId),
    CONSTRAINT CK_ND_VaiTro        CHECK (VaiTro IN ('QUAN_TRI', 'CAN_BO')),
    /* cán bộ bắt buộc thuộc một đơn vị; quản trị toàn hệ thống thì không   */
    CONSTRAINT CK_ND_VaiTro_DonVi  CHECK ((VaiTro = 'CAN_BO' AND DonViId IS NOT NULL)
                                       OR (VaiTro = 'QUAN_TRI'))
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_DK_NguoiDuyet')
  ALTER TABLE dbo.DangKyGhepKhoa
    ADD CONSTRAINT FK_DK_NguoiDuyet FOREIGN KEY (NguoiDuyetId) REFERENCES dbo.NguoiDung (NguoiDungId);
GO

/* ----------------------------------------------------------------- NHẬT KÝ --
   Ai đổi trạng thái đăng ký nào, lúc nào. Danh sách dự thi là văn bản có chữ
   ký nên phải truy được vết.                                                 */
IF OBJECT_ID('dbo.NhatKy', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.NhatKy (
    NhatKyId     bigint IDENTITY(1,1) NOT NULL,
    ThoiDiem     datetimeoffset(0)    NOT NULL CONSTRAINT DF_NhatKy_ThoiDiem DEFAULT (SYSDATETIMEOFFSET()),
    NguoiDungId  int                  NULL,
    HanhDong     varchar(40)          NOT NULL,
    Bang         varchar(40)          NOT NULL,
    KhoaChinh    varchar(40)          NULL,
    NoiDung      nvarchar(1000)       NULL,
    CONSTRAINT PK_NhatKy    PRIMARY KEY (NhatKyId),
    CONSTRAINT FK_NhatKy_ND FOREIGN KEY (NguoiDungId) REFERENCES dbo.NguoiDung (NguoiDungId)
  );
  CREATE INDEX IX_NhatKy_ThoiDiem ON dbo.NhatKy (ThoiDiem DESC);
  CREATE INDEX IX_NhatKy_Bang     ON dbo.NhatKy (Bang, KhoaChinh);
END
GO

PRINT N'001_luoc_do.sql — xong.';
GO
