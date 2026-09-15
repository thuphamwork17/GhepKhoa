/* ============================================================================
   Nới NhatKy.NoiDung để chứa được chi tiết request/response (JSON) kèm theo
   dòng tóm tắt — trang /admin/log hiện thêm phần "Chi tiết" thu gọn được,
   và terminal in đầy đủ hơn để dev debug (trước đây chỉ có một câu tóm tắt
   thân thiện, không đủ để dò lỗi khi cần).
   ========================================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

ALTER TABLE dbo.NhatKy ALTER COLUMN NoiDung nvarchar(MAX) NULL;
GO

PRINT N'010_nhat_ky_chi_tiet.sql — xong.';
GO
