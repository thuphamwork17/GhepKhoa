/* ============================================================================
   Sắp xếp họ tên theo lối Việt Nam.

   ORDER BY HoTen là sai: nó xếp theo họ, ra "Lê Tân Sáng" trước "Ngô Quang
   Anh". Danh sách dự thi và mọi bảng biểu đều xếp theo TÊN RIÊNG trước, rồi
   mới tới HỌ, rồi CHỮ ĐỆM.

   Cách làm: tách sẵn tên riêng và họ thành cột tính sẵn (PERSISTED) để còn
   đánh index được, thay vì cắt chuỗi lúc chạy truy vấn.
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

/* Cắt từ cuối cùng của chuỗi. Cộng thêm một dấu cách để CHARINDEX luôn tìm
   thấy, kể cả khi chuỗi chỉ có một từ.                                       */
IF COL_LENGTH('dbo.HocVien', 'TenRieng') IS NULL
BEGIN
  ALTER TABLE dbo.HocVien ADD
    TenRieng AS (REVERSE(LEFT(REVERSE(RTRIM(HoTen)),
                              CHARINDEX(' ', REVERSE(RTRIM(HoTen)) + ' ') - 1))) PERSISTED,
    Ho       AS (LEFT(LTRIM(HoTen), CHARINDEX(' ', LTRIM(HoTen) + ' ') - 1)) PERSISTED;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HocVien_SapXep' AND object_id = OBJECT_ID('dbo.HocVien'))
  CREATE INDEX IX_HocVien_SapXep ON dbo.HocVien (TenRieng, Ho, HoTen);
GO

IF COL_LENGTH('dbo.DangKyGhepKhoa', 'TenRiengKhai') IS NULL
BEGIN
  ALTER TABLE dbo.DangKyGhepKhoa ADD
    TenRiengKhai AS (REVERSE(LEFT(REVERSE(RTRIM(HoTenKhai)),
                                  CHARINDEX(' ', REVERSE(RTRIM(HoTenKhai)) + ' ') - 1))) PERSISTED,
    HoKhai       AS (LEFT(LTRIM(HoTenKhai), CHARINDEX(' ', LTRIM(HoTenKhai) + ' ') - 1)) PERSISTED;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DK_SapXep' AND object_id = OBJECT_ID('dbo.DangKyGhepKhoa'))
  CREATE INDEX IX_DK_SapXep ON dbo.DangKyGhepKhoa (TenRiengKhai, HoKhai);
GO

/* Bốn cột SapXep1..4 tái hiện đúng thứ tự đang dùng trong các file .xls:

     1. Latin1_General_CI_AI — bỏ hết dấu rồi so chữ cái trần.
        "ÂN" thành "AN" nên đứng trước "ANH"; "ĐĂNG" thành "DANG" nên đứng
        trước "DANH". Vietnamese_CI_AI KHÔNG làm được việc này vì tiếng Việt
        coi Ă Â Đ là chữ cái riêng, xếp sau A và D.
     2. Vietnamese_CI_AS — cùng chữ trần thì phân theo dấu thanh,
        "SANG" trước "SÁNG".
     3, 4. Lặp lại hai mức đó cho HỌ, để hai người trùng tên xếp theo họ.

   Nơi dùng chỉ cần: ORDER BY ThuTuHang, SoKhoaGoc, SapXep1, SapXep2, SapXep3, SapXep4
*/
CREATE OR ALTER VIEW dbo.vw_DangKySapXep AS
SELECT v.*,
       k.TenRiengKhai, k.HoKhai,
       ThuTuHang = ISNULL(h.ThuTu, 32767),
       SoKhoaGoc = ISNULL(kg.SoKhoa, 0),
       SapXep1   = k.TenRiengKhai COLLATE Latin1_General_CI_AI,
       SapXep2   = k.TenRiengKhai COLLATE Vietnamese_CI_AS,
       SapXep3   = k.HoKhai       COLLATE Latin1_General_CI_AI,
       SapXep4   = k.HoKhai       COLLATE Vietnamese_CI_AS,
       TrangThaiHoSo = hs.TrangThaiHoSo,
       ChiTietThieu  = hs.ChiTietThieu
FROM dbo.vw_DangKy v
JOIN dbo.DangKyGhepKhoa k ON k.DangKyId = v.DangKyId
LEFT JOIN dbo.HocVienKhoa hvk ON hvk.HocVienKhoaId = v.HocVienKhoaId
LEFT JOIN dbo.Khoa kg         ON kg.KhoaId = hvk.KhoaId
LEFT JOIN dbo.HangGPLX h      ON h.HangMa = kg.HangMa
LEFT JOIN dbo.HoSoHocVien hs  ON hs.Cccd = v.CccdHoSo AND hs.MaKhoa = v.MaKhoaGocHoSo;
GO

PRINT N'004_sap_xep_ten.sql — xong.';
GO
