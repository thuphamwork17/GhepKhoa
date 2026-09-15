/* ============================================================================
   Nới rộng cột lưu số/hạng GPLX của HocVien.

   Người giữ nhiều giấy phép (vd vừa có B1 vừa đang nâng lên D2) thì nguồn
   GPLX trả về nhiều giá trị nối bằng dấu '|' (xem dstn._gop()). varchar(20)
   chỉ đủ cho MỘT số GPLX (12 số) — hai số nối lại đã tràn, gây lỗi 2628
   "String or binary data would be truncated" ngay lúc lưu, chặn luôn việc
   đối chiếu dù tra cứu đã ra đúng người (vd LÊ ĐÌNH BẢO khóa CEK108).
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

ALTER TABLE dbo.HocVien ALTER COLUMN SoGplxDaCo   varchar(120)  NULL;
ALTER TABLE dbo.HocVien ALTER COLUMN HangGplxDaCo nvarchar(60)  NULL;
GO

PRINT N'008_mo_rong_cot_gplx.sql — xong.';
GO
