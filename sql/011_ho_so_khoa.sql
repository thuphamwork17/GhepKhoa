/* ============================================================================
   011_ho_so_khoa.sql
   Quản lý hồ sơ học viên của tất cả các khóa đào tạo:
   - Giấy khám sức khỏe, Đơn học, Hợp đồng, Bảng khai (nâng hạng), CCCD, Ảnh 1M, Học phí, DAT
   - Bảng lưu vết lịch sử cập nhật chi tiết (Audit Log)
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

USE DrivingManagement;
GO

/* Bổ sung hạng BSTD vào bảng HangGPLX nếu chưa có */
IF NOT EXISTS (SELECT 1 FROM dbo.HangGPLX WHERE HangMa = 'BSTD')
BEGIN
  INSERT INTO dbo.HangGPLX (HangMa, TenHang, ThuTu, DangSuDung)
  VALUES ('BSTD', N'Hạng B (Số tự động)', 25, 1);
END
GO

IF OBJECT_ID('dbo.LichSuHoSo', 'U') IS NOT NULL DROP TABLE dbo.LichSuHoSo;
IF OBJECT_ID('dbo.HoSoHocVien', 'U') IS NOT NULL DROP TABLE dbo.HoSoHocVien;
GO

/* -------------------------------------------------- 1. BẢNG HỒ SƠ HỌC VIÊN - */
CREATE TABLE dbo.HoSoHocVien (
    HoSoId              int IDENTITY(1,1) NOT NULL,
    DonViId             int               NOT NULL,
    HangMa              varchar(10)       NOT NULL,
    MaKhoa              varchar(20)       NOT NULL,
    KhoaId              int               NULL,
    HoTen               nvarchar(120)     COLLATE Vietnamese_CI_AS NOT NULL,
    NgaySinh            nvarchar(50)      NULL,
    Cccd                varchar(20)       NULL,
    SoDienThoai         varchar(30)       NULL,
    DiaChi              nvarchar(400)     COLLATE Vietnamese_CI_AS NULL,
    GiaoVien            nvarchar(120)     COLLATE Vietnamese_CI_AS NULL,
    MaHocVien           varchar(80)       NULL,
    SoHoSo              nvarchar(50)      NULL,
    SoHopDong           nvarchar(50)      NULL,
    HocPhiSoTien        int               NOT NULL CONSTRAINT DF_HSHV_HP DEFAULT (0),
    HocPhiTrangThai     varchar(16)       NOT NULL CONSTRAINT DF_HSHV_TTHP DEFAULT ('CHUA_KIEM'),
    
    -- Từng mục hồ sơ
    CccdTrangThai       varchar(16)       NOT NULL CONSTRAINT DF_HSHV_CCCD DEFAULT ('CHUA_KIEM'), -- DU, THIEU, CHUA_KIEM
    GiayKhamTrangThai   varchar(16)       NOT NULL CONSTRAINT DF_HSHV_GK DEFAULT ('CHUA_KIEM'),   -- DU, THIEU, CAN_KY, CHUA_KIEM
    DonHocTrangThai     varchar(16)       NOT NULL CONSTRAINT DF_HSHV_DON DEFAULT ('DU'),         -- DU, THIEU, CAN_KY, CHUA_KIEM
    HopDongTrangThai    varchar(16)       NOT NULL CONSTRAINT DF_HSHV_HD DEFAULT ('CHUA_KIEM'),   -- DU, THIEU, CHUA_KIEM
    Hinh1MTrangThai     varchar(16)       NOT NULL CONSTRAINT DF_HSHV_1M DEFAULT ('CHUA_KIEM'),   -- DU, THIEU, CHUA_KIEM
    BangKhaiTrangThai   varchar(16)       NOT NULL CONSTRAINT DF_HSHV_BK DEFAULT ('KHONG_CAN'),  -- DU, THIEU, KHONG_CAN, CHUA_KIEM
    DatTrangThai        varchar(16)       NOT NULL CONSTRAINT DF_HSHV_DAT DEFAULT ('CHUA_KIEM'), -- DAT, DANG_CHAY, CHUA_DAT, CHUA_KIEM
    
    -- Trạng thái tổng quát
    TrangThaiHoSo       varchar(16)       NOT NULL CONSTRAINT DF_HSHV_TTHS DEFAULT ('CHUA_KIEM'), -- DU, THIEU, CHUA_KIEM
    ChiTietThieu        nvarchar(500)     NULL,
    GhiChu              nvarchar(1000)    NULL,
    FileNguon           nvarchar(500)     NULL,
    DaXoa               bit               NOT NULL CONSTRAINT DF_HSHV_DaXoa DEFAULT (0),
    TaoLuc              datetimeoffset(0) NOT NULL CONSTRAINT DF_HSHV_Tao DEFAULT (SYSDATETIMEOFFSET()),
    CapNhatLuc          datetimeoffset(0) NOT NULL CONSTRAINT DF_HSHV_CN DEFAULT (SYSDATETIMEOFFSET()),
    NguoiCapNhatId      int               NULL,

    CONSTRAINT PK_HoSoHocVien     PRIMARY KEY (HoSoId),
    CONSTRAINT FK_HSHV_DonVi      FOREIGN KEY (DonViId) REFERENCES dbo.DonVi (DonViId),
    CONSTRAINT FK_HSHV_Hang       FOREIGN KEY (HangMa)  REFERENCES dbo.HangGPLX (HangMa),
    CONSTRAINT FK_HSHV_Khoa       FOREIGN KEY (KhoaId)  REFERENCES dbo.Khoa (KhoaId),
    CONSTRAINT FK_HSHV_NguoiCN    FOREIGN KEY (NguoiCapNhatId) REFERENCES dbo.NguoiDung (NguoiDungId)
);

CREATE INDEX IX_HSHV_DonVi_Khoa ON dbo.HoSoHocVien (DonViId, MaKhoa, DaXoa);
CREATE INDEX IX_HSHV_HoTen      ON dbo.HoSoHocVien (HoTen);
CREATE INDEX IX_HSHV_Cccd       ON dbo.HoSoHocVien (Cccd) WHERE Cccd IS NOT NULL;
CREATE INDEX IX_HSHV_GiaoVien   ON dbo.HoSoHocVien (GiaoVien) WHERE GiaoVien IS NOT NULL;
CREATE INDEX IX_HSHV_TrangThai  ON dbo.HoSoHocVien (TrangThaiHoSo);
GO

/* ------------------------------------------------ 2. BẢNG LỊCH SỬ CẬP NHẬT - */
CREATE TABLE dbo.LichSuHoSo (
    LichSuId            bigint IDENTITY(1,1) NOT NULL,
    HoSoId              int                  NOT NULL,
    ThoiDiem            datetimeoffset(0)    NOT NULL CONSTRAINT DF_LSHS_ThoiDiem DEFAULT (SYSDATETIMEOFFSET()),
    NguoiDungId         int                  NULL,
    HanhDong            varchar(30)          NOT NULL, -- TAO_MOI, DOI_TRANG_THAI, SUA_THONG_TIN, XOA, PHUC_HOI
    TruongThayDoi       varchar(50)          NULL,     -- GiayKham, Cccd, DonHoc, HopDong, BangKhai, HocPhi, HoTen...
    GiaTriCu            nvarchar(500)        NULL,
    GiaTriMoi           nvarchar(500)        NULL,
    GhiChu              nvarchar(1000)       NULL,

    CONSTRAINT PK_LichSuHoSo     PRIMARY KEY (LichSuId),
    CONSTRAINT FK_LSHS_HoSo      FOREIGN KEY (HoSoId) REFERENCES dbo.HoSoHocVien (HoSoId) ON DELETE CASCADE,
    CONSTRAINT FK_LSHS_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES dbo.NguoiDung (NguoiDungId)
);

CREATE INDEX IX_LSHS_HoSo ON dbo.LichSuHoSo (HoSoId, ThoiDiem DESC);
GO

PRINT N'011_ho_so_khoa.sql — Hoàn thành tạo bảng HoSoHocVien và LichSuHoSo (phiên bản mở rộng).';
GO
