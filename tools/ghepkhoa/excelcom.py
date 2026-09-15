# -*- coding: utf-8 -*-
"""Ghi file .xls thông qua chính Excel (COM).

Lý do không dùng openpyxl/xlwt: file mẫu là .xls BIFF8 thật, tiêu đề dùng
font VNI (chuỗi "DANH SAÙCH THÍ SINH…" không phải Unicode), có merge cell,
khung ký tên và độ rộng cột riêng. Để Excel tự mở file mẫu rồi đổ dữ liệu
vào là cách duy nhất giữ nguyên 100% những thứ đó.

File mẫu luôn được mở ở chế độ chỉ đọc — mọi thay đổi chỉ nằm trong bộ nhớ
rồi SaveAs sang tên mới, nên bản gốc không bao giờ bị sửa.
"""

import re
import shutil
from contextlib import contextmanager
from pathlib import Path

import win32com.client

from . import antoan

XL_EXCEL8 = 56                 # định dạng .xls (BIFF8)
XL_DOWN = -4121
XL_UP = -4162
SEC_FORCE_DISABLE = 3          # msoAutomationSecurityForceDisable

TEN_SHEET_VIRUS = "XL4Poppy"


@contextmanager
def excel():
    """Mở một tiến trình Excel ẩn, macro bị chặn cứng, không hiện hộp thoại."""
    try:
        app = win32com.client.DispatchEx("Excel.Application")
    except (AttributeError, ImportError) as e:
        if "gen_py" in str(e) or "CLSIDToClassMap" in str(e):
            # Xóa thư mục cache COM bị lỗi và thử lại
            import win32com.client.gencache as gencache
            shutil.rmtree(gencache.GetGeneratePath(), ignore_errors=True)
            app = win32com.client.DispatchEx("Excel.Application")
        else:
            raise
    sec_cu = None
    try:
        sec_cu = app.AutomationSecurity
        app.AutomationSecurity = SEC_FORCE_DISABLE
        app.Visible = False
        app.DisplayAlerts = False
        app.EnableEvents = False
        app.ScreenUpdating = False
        app.AskToUpdateLinks = False
        yield app
    finally:
        try:
            if sec_cu is not None:
                app.AutomationSecurity = sec_cu
            app.EnableEvents = True
            app.DisplayAlerts = True
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass


@contextmanager
def mo_mau(app, duong_dan):
    """Mở file ở chế độ chỉ đọc (chỉ dùng để đọc/dò cấu trúc)."""
    wb = app.Workbooks.Open(
        str(Path(duong_dan).resolve()),
        UpdateLinks=0,
        ReadOnly=True,
        AddToMru=False,
    )
    try:
        yield wb
    finally:
        try:
            wb.Close(SaveChanges=False)
        except Exception:
            pass


@contextmanager
def mo_ban_sao(app, mau, ra):
    """Nhân bản file mẫu ra `ra` trên đĩa rồi mở BẢN SAO để sửa.

    Không mở bản gốc ở chế độ ghi, nên file mẫu không bao giờ bị đụng tới.
    Phải làm theo cách này thay vì Open(ReadOnly) + SaveAs: workbook chỉ đọc
    không cho chèn thêm sheet (Worksheet.Copy bị Excel lặng lẽ đẩy sang một
    workbook mới thay vì chèn tại chỗ).
    """
    # Chặn ở đây là chốt chặn cuối: dù gọi từ đâu, đích ghi cũng không được
    # nằm trong kho hồ sơ gốc trên máy 'thanh'.
    ra = antoan.duong_dan_ghi(Path(ra).resolve())
    ra.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(Path(mau).resolve()), str(ra))
    wb = app.Workbooks.Open(str(ra), UpdateLinks=0, ReadOnly=False, AddToMru=False)
    try:
        yield wb
        wb.Save()
    finally:
        try:
            wb.Close(SaveChanges=False)
        except Exception:
            pass


# ---------------------------------------------------------------- dò cấu trúc

def tim_sheet_chinh(wb):
    """Sheet chứa danh sách dự thi: là sheet có ô 'SBD' ở cột A."""
    for ws in wb.Worksheets:
        for r in range(1, 16):
            if str(ws.Cells(r, 1).Value or "").strip().upper() == "SBD":
                return ws, r
    raise ValueError("file mẫu không có sheet nào chứa tiêu đề 'SBD' ở cột A")


def vung_du_lieu(ws, dong_header):
    """Trả về (dòng đầu, dòng cuối) của khối dòng đã đánh sẵn SBD trong mẫu."""
    dau = dong_header + 1
    cuoi = dau - 1
    r = dau
    while True:
        v = ws.Cells(r, 1).Value
        if isinstance(v, (int, float)) and float(v) == int(v):
            cuoi = r
            r += 1
        else:
            break
    if cuoi < dau:
        raise ValueError("file mẫu không có dòng SBD nào để làm khuôn")
    return dau, cuoi


def chinh_so_dong(app, ws, dau, cuoi, can):
    """Chèn/xóa dòng để vùng dữ liệu vừa đúng `can` dòng, giữ nguyên định dạng."""
    co = cuoi - dau + 1
    if can > co:
        them = can - co
        ws.Rows(cuoi).Copy()
        ws.Rows(f"{cuoi + 1}:{cuoi + them}").Insert(XL_DOWN)
        app.CutCopyMode = False
    elif can < co:
        ws.Rows(f"{dau + can}:{cuoi}").Delete()
    return dau, dau + can - 1


# ---------------------------------------------------------------- ghi dữ liệu

def dong_cuoi_co_chu(ws, cot=(1, 2, 3, 5)):
    """Dòng cuối cùng thực sự có nội dung.

    Không dùng UsedRange: sau khi Delete bớt dòng, Excel vẫn giữ UsedRange
    theo vùng cũ cho tới khi lưu, nên nó trả về số dòng lớn hơn thực tế.
    """
    return max(ws.Cells(ws.Rows.Count, c).End(XL_UP).Row for c in cot)


def dat_dinh_dang_chu(ws, dau, cuoi, cot):
    """Ép các cột về dạng Text để CCCD / GPLX không mất số 0 đầu."""
    for c in cot:
        ws.Range(ws.Cells(dau, c), ws.Cells(cuoi, c)).NumberFormat = "@"


def ghi_khoi(ws, dau, bang):
    """Ghi `bang` (list các list, đã đủ chiều rộng) bắt đầu từ dòng `dau`.

    Ghi cả khối bằng một lần gán mảng — nhanh hơn nhiều so với ghi từng ô,
    và tránh việc Excel tự suy diễn kiểu dữ liệu giữa chừng.
    """
    if not bang:
        return
    rong = max(len(h) for h in bang)
    bang = [list(h) + [None] * (rong - len(h)) for h in bang]
    o = ws.Range(ws.Cells(dau, 1), ws.Cells(dau + len(bang) - 1, rong))
    o.Value = tuple(tuple(h) for h in bang)


# ---------------------------------------------------------------- sửa tiêu đề

_RE_GHEP = re.compile(r"(GH[ÉE]P\s+KH[ÓO]A\s*)(\S.*?)(\s*$)", re.IGNORECASE | re.MULTILINE)
_RE_NGAY_VNI = re.compile(r"(NGA[ØY]Y\s*)(\d{1,2}/\d{1,2}/\d{4})", re.IGNORECASE)
_RE_NGAY_DMY = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b")
# "ngày 18 tháng 07 năm 2026" viết được hai kiểu: Unicode ("ngày") và VNI
# ("ngaøy" — chữ à là hai ký tự a + ø). Bắt cả hai bằng cách cho phép 1–3 ký
# tự bất kỳ ở vị trí nguyên âm, thay vì liệt kê từng biến thể.
_RE_NGAY_CHU = re.compile(
    r"(ng\S{1,2}y\s*)(\d{1,2})(\s*th\S{1,3}ng\s*)(\d{1,2})(\s*n\S{1,2}m\s*)(\d{4})",
    re.IGNORECASE,
)


def sua_tieu_de(ws, ma_khoa, ngay, bo_qua=None):
    """Cập nhật mã khóa + ngày thi trong tiêu đề và khối ký tên.

    Chỉ thay đúng phần mã khóa và phần ngày, giữ nguyên toàn bộ chuỗi VNI
    xung quanh (đụng vào là hỏng font).

    `bo_qua` = (dòng đầu, dòng cuối) của vùng dữ liệu — BẮT BUỘC truyền vào,
    nếu không hàm sẽ nuốt luôn cột Ngày Sinh của học viên.
    """
    d, m, y = ngay.day, ngay.month, ngay.year
    dmy = f"{d:02d}/{m:02d}/{y}"
    bo_dau_dong, bo_cuoi_dong = bo_qua if bo_qua else (0, -1)
    da_sua = []
    for r in range(1, max(60, bo_cuoi_dong + 12)):
        if bo_dau_dong <= r <= bo_cuoi_dong:
            continue
        for c in range(1, 12):
            o = ws.Cells(r, c)
            v = o.Value
            if not isinstance(v, str) or not v.strip():
                continue
            moi = v
            if "SBD" in v.upper():
                continue
            moi = _RE_GHEP.sub(lambda mt: mt.group(1) + ma_khoa + mt.group(3), moi)
            if _RE_NGAY_VNI.search(moi):
                moi = _RE_NGAY_VNI.sub(lambda mt: mt.group(1) + dmy, moi)
            elif _RE_NGAY_DMY.search(moi):
                moi = _RE_NGAY_DMY.sub(dmy, moi)
            moi = _RE_NGAY_CHU.sub(
                lambda mt: f"{mt.group(1)}{d:02d}{mt.group(3)}{m:02d}{mt.group(5)}{y}", moi
            )
            if moi != v:
                o.Value = moi
                da_sua.append((ws.Name, r, c, v.replace("\n", " ⏎ "), moi.replace("\n", " ⏎ ")))
    return da_sua


# ---------------------------------------------------------------- vệ sinh file

def nhan_ban_sheet(wb, ws, ten_moi):
    """Nhân bản `ws` ngay sau nó và đặt tên `ten_moi`. Xóa sheet trùng tên cũ.

    Lưu ý: qua late-binding COM, tham số `After` của Worksheet.Copy không tới
    được Excel — Excel hiểu là "không có đích" và đẩy bản sao sang một workbook
    MỚI. Chỉ `Before` mới đi lọt, nên ta chèn trước sheet kế tiếp.
    """
    for s in [x.Name for x in wb.Sheets]:
        if s.strip().lower() == ten_moi.strip().lower():
            wb.Sheets(s).Delete()
    vi_tri = ws.Index
    if vi_tri < wb.Sheets.Count:
        ws.Copy(wb.Sheets(vi_tri + 1))
    else:
        ws.Copy(None, ws)
    moi = wb.Sheets(vi_tri + 1)
    if moi.Name != ten_moi:
        moi.Name = ten_moi
    return moi


def xoa_sheet_virus(wb):
    """Xóa sheet macro Excel 4.0 'XL4Poppy' (virus XF.Classic/Poppy) nếu có."""
    xoa = []
    for ten in [s.Name for s in wb.Sheets]:
        if ten.strip().lower() == TEN_SHEET_VIRUS.lower():
            wb.Sheets(ten).Delete()
            xoa.append(ten)
    return xoa


def luu_thanh(wb, duong_dan):
    p = antoan.duong_dan_ghi(Path(duong_dan).resolve())
    p.parent.mkdir(parents=True, exist_ok=True)
    wb.SaveAs(str(p), FileFormat=XL_EXCEL8)
    return p
