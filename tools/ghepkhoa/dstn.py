# -*- coding: utf-8 -*-
r"""Đọc file "TN <ngày>.xlsx" do web xuất ra rồi đối chiếu để lập DS ghép khóa.

File đầu vào có hai sheet, mỗi sheet một đơn vị:
    TT      -> Trung tâm  (mã cơ sở 92004)
    TRƯỜNG  -> Trường CĐ  (mã cơ sở 92001)
Cột: STT | NGÀY | SỐ HĐ- LẦN 2 | HỌ TÊN | GV | KHOÁ

Chỉ có họ tên và mã khóa cũ, không có CCCD — nên phải dò theo tên bên trong
đúng một khóa. Nguồn dữ liệu:

    92004  ->  database GPLX_KhaoSat (nhanh, sạch)
    92001  ->  database GPLX_CSDT trên máy chủ "cdtd" (mạng nội bộ Trường);
               nếu máy đang chạy không vào được mạng đó thì rơi xuống
               DrivingManagement (bộ nhớ đệm nạp sẵn từ Bao cao 1 qua 'napdb')

Tất cả các nguồn đều CHỈ ĐỌC.
"""

import re
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import baocao, config, napdb, sqlrun
from .vn import bo_dau

# Máy chủ/database/mật khẩu lấy từ config.ini — đổi ở đó, không đổi ở đây.
MAY_CHU_GPLX = config.TRUNG_TAM_MAY_CHU
CSDL_GPLX = config.TRUNG_TAM_CSDL

# Database của bên Trường (92001) — nằm trong mạng nội bộ của Trường, không
# cùng domain nên đăng nhập bằng tài khoản SQL, không phải Windows auth.
# CHỈ ĐỌC — không có hàm ghi nào trỏ tới máy chủ này, xem sqlrun.truy_van().
MAY_CHU_TRUONG = config.TRUONG_MAY_CHU
CSDL_TRUONG = config.TRUONG_CSDL
NGUOI_DUNG_TRUONG = config.TRUONG_NGUOI_DUNG
MAT_KHAU_TRUONG = config.TRUONG_MAT_KHAU

# Tên sheet -> mã cơ sở
SHEET_DON_VI = {"TT": "92004", "TRUONG": "92001", "TRƯỜNG": "92001"}

# "B(STĐ)K93" là cách viết trên giấy của hạng B1 khóa 93.
_BIET_DANH_HANG = {"B(STD)": "B1", "B(STĐ)": "B1", "BSTD": "B1"}

# Chiều ngược lại: đã chuẩn hóa thành "B1" rồi thì khi DÒ NGƯỢC trong database
# GPLX (cột TenKH lưu nguyên văn theo cách viết cũ, KHÔNG tự chuẩn hóa) phải
# thử lại cả các biệt danh gốc — TenKH ghi "B(STĐ) KHÓA 93/2026" chứ không
# ghi "B1 KHÓA 93/2026", tìm đúng "B1KHÓA93" sẽ không ra kết quả nào.
_HANG_BIET_DANH_NGUOC: dict = {}
for _bd, _chuan in _BIET_DANH_HANG.items():
    _HANG_BIET_DANH_NGUOC.setdefault(_chuan, []).append(_bd)

_RE_MA = re.compile(r"^\s*(.+?)K\s*(\d{1,4})\s*$", re.IGNORECASE)

# "KHÓA" (dấu ở O) và "KHOÁ" (dấu ở A) đều là cách viết đúng, người nhập liệu
# gõ lẫn lộn cả hai — có khóa thật (vd "B KHOÁ 121/2026") lại dùng đúng dạng
# mà nếu chỉ dò một kiểu sẽ không bao giờ ra, dù dữ liệu có thật trong DB.
_CACH_VIET_KHOA = ("KHÓA", "KHOÁ")


def _mau_like(s: str) -> str:
    """Chuỗi người dùng gõ tay -> literal N'%...%' an toàn cho LIKE — phải tự
    escape dấu nháy đơn vì kiến trúc này chạy mọi câu lệnh qua sqlcmd -Q,
    không có chỗ tham số hóa thật (không giống driver mssql bên Node)."""
    return "N'%" + (s or "").strip().replace("'", "''").replace("%", "") + "%'"


_RE_TENKH = re.compile(r"^\s*(.+?)\s*KHO[ÁA]\s*(\d+)", re.IGNORECASE)


def _ma_khoa_tu_tenkh(ten_kh: str) -> str:
    """'C1 KHÓA 84/2026' -> 'C1K84'; 'B(STĐ) KHÓA 93/2026' -> 'B1K93'."""
    m = _RE_TENKH.match(ten_kh or "")
    return chuan_ma_khoa(f"{m.group(1)}K{m.group(2)}") if m else ""


def _ung_vien_ten_khoa(hang: str, so: int) -> list:
    """Mọi cách viết TenKH có thể gặp cho một hạng+số khóa — hạng đã chuẩn
    hóa trước, cộng thêm các biệt danh gốc nếu có (xem _HANG_BIET_DANH_NGUOC),
    nhân với cả hai cách viết "khóa"/"khoá" (xem _CACH_VIET_KHOA).
    """
    ten_hang = [hang, *_HANG_BIET_DANH_NGUOC.get(hang, [])]
    return [
        f"{h}{tu}{so}"
        for h in dict.fromkeys(ten_hang)
        for tu in _CACH_VIET_KHOA
    ]


@dataclass
class DongDangKy:
    stt: str
    ho_ten: str
    giao_vien: str
    ma_khoa_goc: str
    ma_co_so: str
    dong: int
    # điền sau khi đối chiếu
    ngay_sinh: str = ""
    cccd: str = ""
    dia_chi: str = ""
    hang_gplx: str = ""
    so_gplx: str = ""
    ma_hoc_vien: str = ""
    nguon: str = ""


@dataclass
class KetQua:
    khop: list = field(default_factory=list)
    canh_bao: list = field(default_factory=list)


def chuan_ma_khoa(s: str) -> str:
    """'B(STĐ)K93' -> 'B1K93';  'c1k54' -> 'C1K54'."""
    t = re.sub(r"\s+", "", (s or "")).upper()
    m = _RE_MA.match(t)
    if not m:
        return t
    hang, so = m.group(1), int(m.group(2))
    hang = _BIET_DANH_HANG.get(hang, hang)
    return f"{hang}K{so}"


def tach_hang_so(ma: str):
    m = _RE_MA.match(ma or "")
    return (m.group(1), int(m.group(2))) if m else (None, None)


# ------------------------------------------------------------------- đọc vào

def doc_file_dang_ky(duong_dan):
    """Trả về (danh sách DongDangKy, cảnh báo, ngày ghi trong tiêu đề)."""
    import openpyxl

    wb = openpyxl.load_workbook(str(duong_dan), data_only=True)
    ds, canh_bao, ngay_tieu_de = [], [], ""

    for ws in wb.worksheets:
        ten = ws.title.strip().upper()
        cs = SHEET_DON_VI.get(ten)
        if not cs:
            continue

        hang = [
            ["" if c is None else str(c).strip() for c in r]
            for r in ws.iter_rows(values_only=True)
        ]
        if not ngay_tieu_de:
            for h in hang[:3]:
                m = re.search(r"NG[ÀA]Y\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})", " ".join(h), re.I)
                if m:
                    ngay_tieu_de = f"{int(m.group(1)):02d}/{int(m.group(2)):02d}/{m.group(3)}"
                    break

        # dòng tiêu đề là dòng có cả "HỌ TÊN" và "KHOÁ"
        i_hdr = next(
            (
                i
                for i, h in enumerate(hang[:6])
                if any("HO TEN" in bo_dau(x) for x in h) and any("KHOA" in bo_dau(x) for x in h)
            ),
            None,
        )
        if i_hdr is None:
            canh_bao.append(f"Sheet '{ws.title}': không tìm thấy dòng tiêu đề, bỏ qua.")
            continue

        cot = {}
        for j, x in enumerate(hang[i_hdr]):
            b = bo_dau(x)
            if "HO TEN" in b:
                cot["ten"] = j
            elif b == "GV" or "GIAO VIEN" in b:
                cot["gv"] = j
            elif "KHOA" in b:
                cot["khoa"] = j
            elif b == "STT":
                cot["stt"] = j

        for i, h in enumerate(hang[i_hdr + 1:], start=i_hdr + 2):
            lay = lambda k: h[cot[k]].strip() if k in cot and cot[k] < len(h) else ""  # noqa: E731
            ho_ten = re.sub(r"\s+", " ", lay("ten")).upper()
            ma_khoa = chuan_ma_khoa(lay("khoa"))
            if not ho_ten:
                continue
            if not ma_khoa:
                canh_bao.append(f"Sheet '{ws.title}' dòng {i}: {ho_ten} — thiếu mã khóa, bỏ qua.")
                continue
            ds.append(
                DongDangKy(
                    stt=lay("stt"),
                    ho_ten=ho_ten,
                    giao_vien=lay("gv"),
                    ma_khoa_goc=ma_khoa,
                    ma_co_so=cs,
                    dong=i,
                )
            )
    return ds, canh_bao, ngay_tieu_de


# ---------------------------------------------------- nguồn 92004: DB GPLX

def _sqlcmd(cau_lenh: str):
    """Câu SELECT có PRINT/DECLARE ở đầu thì sqlrun.truy_van() (dùng -Q) vẫn
    chạy được — sqlcmd không phân biệt -Q hay -i, đều nhận một chuỗi lệnh."""
    return sqlrun.truy_van(
        MAY_CHU_GPLX, CSDL_GPLX, cau_lenh,
        nguoi_dung=config.TRUNG_TAM_NGUOI_DUNG,
        mat_khau=config.TRUNG_TAM_MAT_KHAU,
    )


def nap_khoa_tu_db(ma_khoa: str):
    """Toàn bộ học viên của một khóa, lấy từ database GPLX.

    Tìm khóa theo cột TenKH ("C1 KHÓA 84/2026"), KHÔNG theo HangGPLX. Cột
    HangGPLX giữ mã hạng theo danh mục mới nên khóa hạng B lại ghi 'B1', khóa
    CE ghi 'FC' — lấy nó để lọc là trượt hết.

    Bỏ hết khoảng trắng trước khi so vì tên khóa gõ tay, chỗ một dấu cách chỗ
    hai. Có khóa không ghi năm ("C1 KHÓA 87") nên phải nhận cả hai dạng.
    """
    hang, so = tach_hang_so(ma_khoa)
    if not hang:
        return None
    dieu_kien = " OR ".join(
        f"REPLACE(TenKH,' ','') = N'{t}' OR REPLACE(TenKH,' ','') LIKE N'{t}/%'"
        for t in _ung_vien_ten_khoa(hang, so)
    )
    q = f"""SET NOCOUNT ON;
DECLARE @ma varchar(13) = (
  SELECT TOP 1 MaKH FROM dbo.KhoaHoc
   WHERE {dieu_kien}
   ORDER BY NgayKG DESC);
IF @ma IS NULL RETURN;
DECLARE @cs varchar(6) = (SELECT MaCSDT   FROM dbo.KhoaHoc WHERE MaKH = @ma);
DECLARE @hg varchar(3) = (SELECT HangGPLX FROM dbo.KhoaHoc WHERE MaKH = @ma);
DECLARE @bg varchar(10) = (SELECT CONVERT(varchar(10), NgayBG, 120) FROM dbo.KhoaHoc WHERE MaKH = @ma);
SELECT n.HoVaTen,
  RIGHT(n.NgaySinh,2) + '/' + SUBSTRING(n.NgaySinh,5,2) + '/' + LEFT(n.NgaySinh,4),
  ISNULL(n.SoCMT,''),
  LTRIM(RTRIM(ISNULL(n.NoiTT,N'') + N' ' + ISNULL(dv.TenDayDu,N''))),
  ISNULL(h.HangGPLXDaCo,''), ISNULL(h.SoGPLXDaCo,''),
  ISNULL(n.MaDK,'') + '-' + ISNULL(@hg,''),
  ISNULL(@bg, '')
FROM dbo.NguoiLX_HoSo h
JOIN dbo.NguoiLX n ON n.MaDK = h.MaDK
OUTER APPLY (SELECT TOP 1 TenDayDu FROM dbo.DM_DVHC WHERE MaDvhc = n.NoiTT_MaDVHC ORDER BY TrangThai DESC) dv
WHERE h.MaKhoaHoc = @ma;"""
    ra = []
    for h in _sqlcmd(q):
        if len(h) < 8:
            continue
        ra.append({
            "ho_ten": h[0].strip(), "ngay_sinh": h[1].strip(), "cccd": h[2].strip(),
            "dia_chi": " ".join(h[3].split()), "hang_gplx": h[4].strip(),
            "so_gplx": h[5].strip(), "ma_hoc_vien": h[6].strip(),
            "ngay_be_giang": h[7].strip(),
        })
    return ra or None


def khoa_co_o_trung_tam(ma_khoa: str) -> bool:
    """True nếu mã khóa này thực ra có trong GPLX_KhaoSat (của Trung tâm).

    Dùng khi tra ở cơ sở khác không ra kết quả — thường là do người nhập
    chọn nhầm đợt (vd chọn đợt của Trường nhưng gõ mã khóa cũ của Trung tâm).
    Tra nhanh vì GPLX_KhaoSat ở máy nội bộ, không phải chờ mạng như CHITHANH.
    """
    hang, so = tach_hang_so(ma_khoa)
    if not hang:
        return False
    q = f"""SET NOCOUNT ON;
SELECT TOP 1 1 FROM dbo.KhoaHoc
 WHERE (REPLACE(TenKH, ' ', '') = N'{hang}KHÓA{so}'
    OR REPLACE(TenKH, ' ', '') LIKE N'{hang}KHÓA{so}' + N'/%');"""
    return bool(_sqlcmd(q))


_Q_TIM_THEO_TEN = """SET NOCOUNT ON;
SELECT TOP {gioi_han} n.HoVaTen,
  RIGHT(n.NgaySinh,2) + '/' + SUBSTRING(n.NgaySinh,5,2) + '/' + LEFT(n.NgaySinh,4),
  ISNULL(n.SoCMT,''),
  k.TenKH
FROM dbo.NguoiLX n
JOIN dbo.NguoiLX_HoSo h ON h.MaDK = n.MaDK
JOIN dbo.KhoaHoc k ON k.MaKH = h.MaKhoaHoc
WHERE n.HoVaTen COLLATE Latin1_General_CI_AI LIKE {mau} COLLATE Latin1_General_CI_AI
ORDER BY k.NgayKG DESC;"""


def tim_theo_ten(mot_phan_ten: str, gioi_han: int = 10):
    """Tìm học viên theo MỘT PHẦN họ tên trong TOÀN BỘ database GPLX của
    Trung tâm — không cần biết trước mã khóa cũ, để gõ tên trước rồi chọn ra
    đúng khóa cũ. Không phân biệt dấu (gõ "BAO" ra được cả "BẢO"/"BÃO") nhờ
    ép COLLATE Latin1_General_CI_AI — HoVaTen mặc định PHÂN BIỆT dấu
    (SQL_Latin1_General_CP1_CI_AS) nên LIKE thường sẽ bỏ sót.
    """
    if len(mot_phan_ten.strip()) < 2:
        return []
    q = _Q_TIM_THEO_TEN.format(gioi_han=int(gioi_han), mau=_mau_like(mot_phan_ten))
    ra = []
    for h in _sqlcmd(q):
        if len(h) < 4:
            continue
        ra.append({
            "ho_ten": h[0].strip(), "ngay_sinh": h[1].strip(), "cccd": h[2].strip(),
            "ma_khoa": _ma_khoa_tu_tenkh(h[3]),
        })
    return ra


# -------------------------------------- nguồn 92001: database "cdtd" (Trường)

_DANH_DAU_LOI_TRUONG = Path(__file__).parent / ".loi_ket_noi_truong"
_THOI_GIAN_NHO_LOI = 60  # giây — bỏ qua thử lại CHITHANH trong khoảng này sau khi vừa thất bại


def _truong_vua_loi() -> bool:
    try:
        return time.time() - _DANH_DAU_LOI_TRUONG.stat().st_mtime < _THOI_GIAN_NHO_LOI
    except FileNotFoundError:
        return False


def _sqlcmd_truong(cau_lenh: str):
    # Mỗi tiến trình Python là một lần gọi riêng (Node spawn mới mỗi lần),
    # không giữ được biến nhớ trong RAM giữa các lần — nên nhớ tạm bằng một
    # file đánh dấu thời điểm thất bại gần nhất. Vừa thất bại trong vòng
    # _THOI_GIAN_NHO_LOI giây thì bỏ qua luôn, không mất thêm vài giây thử
    # lại một máy chủ gần như chắc chắn vẫn chưa vào được (không cùng mạng).
    if _truong_vua_loi():
        raise sqlrun.LoiSqlcmd("Vừa thất bại gần đây, bỏ qua thử lại CHITHANH.")
    try:
        ra = sqlrun.truy_van(
            MAY_CHU_TRUONG, CSDL_TRUONG, cau_lenh,
            nguoi_dung=NGUOI_DUNG_TRUONG, mat_khau=MAT_KHAU_TRUONG, thoi_gian_cho=3,
        )
        _DANH_DAU_LOI_TRUONG.unlink(missing_ok=True)  # kết nối được rồi — xóa dấu lỗi cũ
        return ra
    except sqlrun.LoiSqlcmd:
        _DANH_DAU_LOI_TRUONG.write_text(str(time.time()), encoding="utf-8")
        raise


def nap_khoa_tu_db_truong(ma_khoa: str):
    """Toàn bộ học viên của một khóa, lấy từ database riêng của Trường
    (CHITHANH\\SQLEXPRESS, database "cdtd"). CHỈ ĐỌC. Chỉ kết nối được từ
    trong mạng nội bộ của Trường — máy chạy web/Python phải cùng mạng đó.

    CHƯA KIỂM CHỨNG được cấu trúc bảng thật trên máy chủ này (viết lúc chưa
    vào được mạng để thử) — chép nguyên cấu trúc câu lệnh của nap_khoa_tu_db()
    (dùng cho GPLX_KhaoSat bên Trung tâm) vì cùng dòng phần mềm sát hạch, khả
    năng cao cùng tên bảng/cột. Nếu chạy thật mà lỗi "Invalid column/object
    name" thì phải dò lại tên bảng/cột đúng của database "cdtd" rồi sửa lại
    câu lệnh bên dưới — dò trực tiếp bằng:
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    """
    hang, so = tach_hang_so(ma_khoa)
    if not hang:
        return None
    dieu_kien = " OR ".join(
        f"REPLACE(TenKH,' ','') = N'{t}' OR REPLACE(TenKH,' ','') LIKE N'{t}/%'"
        for t in _ung_vien_ten_khoa(hang, so)
    )
    q = f"""SET NOCOUNT ON;
DECLARE @ma varchar(13) = (
  SELECT TOP 1 MaKH FROM dbo.KhoaHoc
   WHERE {dieu_kien}
   ORDER BY NgayKG DESC);
IF @ma IS NULL RETURN;
DECLARE @cs varchar(6) = (SELECT MaCSDT   FROM dbo.KhoaHoc WHERE MaKH = @ma);
DECLARE @hg varchar(3) = (SELECT HangGPLX FROM dbo.KhoaHoc WHERE MaKH = @ma);
DECLARE @bg varchar(10) = (SELECT CONVERT(varchar(10), NgayBG, 120) FROM dbo.KhoaHoc WHERE MaKH = @ma);
SELECT n.HoVaTen,
  RIGHT(n.NgaySinh,2) + '/' + SUBSTRING(n.NgaySinh,5,2) + '/' + LEFT(n.NgaySinh,4),
  ISNULL(n.SoCMT,''),
  LTRIM(RTRIM(ISNULL(n.NoiTT,N'') + N' ' + ISNULL(dv.TenDayDu,N''))),
  ISNULL(h.HangGPLXDaCo,''), ISNULL(h.SoGPLXDaCo,''),
  ISNULL(n.MaDK,'') + '-' + ISNULL(@hg,''),
  ISNULL(@bg, '')
FROM dbo.NguoiLX_HoSo h
JOIN dbo.NguoiLX n ON n.MaDK = h.MaDK
OUTER APPLY (SELECT TOP 1 TenDayDu FROM dbo.DM_DVHC WHERE MaDvhc = n.NoiTT_MaDVHC ORDER BY TrangThai DESC) dv
WHERE h.MaKhoaHoc = @ma;"""
    ra = []
    for h in _sqlcmd_truong(q):
        if len(h) < 8:
            continue
        ra.append({
            "ho_ten": h[0].strip(), "ngay_sinh": h[1].strip(), "cccd": h[2].strip(),
            "dia_chi": " ".join(h[3].split()), "hang_gplx": h[4].strip(),
            "so_gplx": h[5].strip(), "ma_hoc_vien": h[6].strip(),
            "ngay_be_giang": h[7].strip(),
        })
    return ra or None


def tim_theo_ten_truong(mot_phan_ten: str, gioi_han: int = 10):
    """Bản tim_theo_ten() cho database của Trường — xem tim_theo_ten() ở
    phần 92004 để hiểu vì sao cần COLLATE Latin1_General_CI_AI. Qua
    _sqlcmd_truong() nên tự có sẵn cơ chế nhớ tạm lỗi mạng (60 giây)."""
    if len(mot_phan_ten.strip()) < 2:
        return []
    q = _Q_TIM_THEO_TEN.format(gioi_han=int(gioi_han), mau=_mau_like(mot_phan_ten))
    ra = []
    for h in _sqlcmd_truong(q):
        if len(h) < 4:
            continue
        ra.append({
            "ho_ten": h[0].strip(), "ngay_sinh": h[1].strip(), "cccd": h[2].strip(),
            "ma_khoa": _ma_khoa_tu_tenkh(h[3]),
        })
    return ra


# -------------------------------- nguồn dự phòng 92001: DrivingManagement --
# Dùng khi không vào được mạng nội bộ của Trường (xem nap_khoa_tu_db_truong).

def _sqlcmd_dm(cau_lenh: str):
    return sqlrun.truy_van(napdb.MAY_CHU_MD, napdb.CSDL_MD, cau_lenh)


def nap_khoa_tu_dm(ma_khoa: str, ma_co_so: str):
    """Toàn bộ học viên của một khóa cũ lấy từ DrivingManagement.

    Dữ liệu vào đây qua lệnh 'napdb' (nạp từ Bao cao 1) hoặc qua 'napmot'
    (đối chiếu từng người). Tra SQL thay vì quét ổ E qua mạng.
    """
    hang, so = tach_hang_so(ma_khoa)
    if not hang:
        return None
    q = f"""SET NOCOUNT ON;
SELECT hv.HoTen,
  ISNULL(CONVERT(varchar,hv.NgaySinh,103),''),
  ISNULL(hv.Cccd,''),
  ISNULL(hv.NoiThuongTru,''),
  ISNULL(hv.HangGplxDaCo,''),
  ISNULL(hv.SoGplxDaCo,''),
  ISNULL(hvk.MaHocVien,''),
  ISNULL(CONVERT(varchar(10),k.NgayBeGiang,120),'')
FROM dbo.HocVienKhoa hvk
JOIN dbo.HocVien hv ON hv.HocVienId = hvk.HocVienId
JOIN dbo.Khoa k       ON k.KhoaId    = hvk.KhoaId
JOIN dbo.DonVi dv     ON dv.DonViId  = k.DonViId
WHERE dv.MaCoSo = '{ma_co_so}'
  AND k.HangMa  = N'{hang}'
  AND k.SoKhoa  = {so};"""
    ra = []
    for h in _sqlcmd_dm(q):
        if len(h) < 8:
            continue
        ra.append({
            "ho_ten": h[0].strip(), "ngay_sinh": h[1].strip(), "cccd": h[2].strip(),
            "dia_chi": " ".join(h[3].split()), "hang_gplx": h[4].strip(),
            "so_gplx": h[5].strip(), "ma_hoc_vien": h[6].strip(),
            "ngay_be_giang": h[7].strip(),
        })
    return ra or None


def tim_theo_ten_dm(mot_phan_ten: str, ma_co_so: str, gioi_han: int = 10):
    """Bản tim_theo_ten() đọc từ DrivingManagement (nguồn dự phòng 92001) —
    HocVien.HoTen ở đây COLLATE Vietnamese_CI_AS (khai báo lúc tạo bảng),
    cũng phân biệt dấu như bên GPLX nên vẫn cần ép Latin1_General_CI_AI."""
    if len(mot_phan_ten.strip()) < 2:
        return []
    q = f"""SET NOCOUNT ON;
SELECT TOP {int(gioi_han)} hv.HoTen,
  ISNULL(CONVERT(varchar,hv.NgaySinh,103),''),
  ISNULL(hv.Cccd,''),
  k.HangMa, k.SoKhoa
FROM dbo.HocVienKhoa hvk
JOIN dbo.HocVien hv ON hv.HocVienId = hvk.HocVienId
JOIN dbo.Khoa k       ON k.KhoaId    = hvk.KhoaId
JOIN dbo.DonVi dv     ON dv.DonViId  = k.DonViId
WHERE dv.MaCoSo = '{ma_co_so}'
  AND hv.HoTen COLLATE Latin1_General_CI_AI LIKE {_mau_like(mot_phan_ten)} COLLATE Latin1_General_CI_AI;"""
    ra = []
    for h in _sqlcmd_dm(q):
        if len(h) < 5:
            continue
        ra.append({
            "ho_ten": h[0].strip(), "ngay_sinh": h[1].strip(), "cccd": h[2].strip(),
            "ma_khoa": f"{h[3].strip()}K{h[4].strip()}",
        })
    return ra


# Giữ lại để code cũ (lenh.py, GUI) vẫn gọi được nếu cần.
def nap_khoa_tu_excel(ma_khoa: str, chi_muc, ma_co_so: str):
    ung = [k for k in chi_muc if k.ma_khoa == ma_khoa and k.ma_co_so == ma_co_so]
    if not ung or not ung[0].file_bao_cao_1:
        return None
    bc = baocao.doc(ung[0].file_bao_cao_1)
    return [
        {
            "ho_ten": h.ho_ten, "ngay_sinh": h.ngay_sinh, "cccd": h.cccd,
            "dia_chi": " ".join(h.dia_chi.split()), "hang_gplx": h.hang_gplx,
            "so_gplx": h.so_gplx, "ma_hoc_vien": h.ma_hoc_vien,
        }
        for h in bc.hoc_vien
    ]


# ------------------------------------------------------------------ đối chiếu

def doi_chieu(ds, chi_muc=None):
    """Điền dữ liệu thật vào từng dòng đăng ký. Trả về KetQua."""
    kq = KetQua()
    bo_nho = {}

    for d in ds:
        khoa = (d.ma_co_so, d.ma_khoa_goc)
        if khoa not in bo_nho:
            try:
                if d.ma_co_so == "92004":
                    bo_nho[khoa] = (nap_khoa_tu_db(d.ma_khoa_goc), "DB GPLX")
                else:
                    bo_nho[khoa] = (
                        nap_khoa_tu_excel(d.ma_khoa_goc, chi_muc or [], d.ma_co_so),
                        "Bao cao 1",
                    )
            except Exception as e:  # noqa: BLE001
                bo_nho[khoa] = (None, f"lỗi: {e}")

        ds_khoa, nguon = bo_nho[khoa]
        if not ds_khoa:
            kq.canh_bao.append(
                f"KHÔNG CÓ DỮ LIỆU KHÓA {d.ma_khoa_goc} (cơ sở {d.ma_co_so}) — "
                f"{d.ho_ten} không lập được. {nguon if nguon.startswith('lỗi') else ''}".strip()
            )
            continue

        ten_can = bo_dau(d.ho_ten)
        ung = [x for x in ds_khoa if bo_dau(x["ho_ten"]) == ten_can]
        if not ung:
            kq.canh_bao.append(
                f"KHÔNG TÌM THẤY: {d.ho_ten} trong khóa {d.ma_khoa_goc} "
                f"(cơ sở {d.ma_co_so}, dòng {d.dong}). Kiểm tra lại tên hoặc mã khóa."
            )
            continue
        if len(ung) > 1:
            kq.canh_bao.append(
                f"TRÙNG TÊN: {d.ho_ten} có {len(ung)} người trong khóa {d.ma_khoa_goc} — "
                + " | ".join(f"{x['ngay_sinh']}/{x['cccd']}" for x in ung)
                + ". Cần ngày sinh để phân biệt, tạm bỏ qua."
            )
            continue

        x = ung[0]
        d.ngay_sinh = x["ngay_sinh"]
        d.cccd = x["cccd"]
        d.dia_chi = x["dia_chi"]
        d.hang_gplx = x["hang_gplx"]
        d.so_gplx = x["so_gplx"]
        d.ma_hoc_vien = x["ma_hoc_vien"]
        d.nguon = nguon
        kq.khop.append(d)

    return kq


# quet_chi_muc_truong() đã bỏ — 92001 giờ dùng DrivingManagement (nap_khoa_tu_dm).


# --------------------------------------------------------------- sinh file

def _gop(gt: str) -> str:
    """'Cm|D2' -> 'Cm, D2'; '960...|960...' -> '960...'.

    Người giữ nhiều giấy phép thì database trả về các giá trị ngăn bằng '|'.
    Trùng nhau thì rút còn một, khác nhau thì nối lại cho cán bộ nhìn thấy đủ.
    """
    phan = [x.strip() for x in (gt or "").split("|") if x.strip()]
    ra = list(dict.fromkeys(phan))
    return ", ".join(ra)


def sinh_file(ds, ma_khoa_dich, ngay_thi, file_mau, file_ra, cau_hinh=None):
    """Đổ danh sách đã đối chiếu vào bản sao của file mẫu.

    Không đụng file mẫu: excelcom nhân bản ra đích rồi mới mở bản sao, và
    antoan chặn nếu đích nằm trong kho hồ sơ gốc.
    """
    from . import excelcom
    from .lenh import _khoa_sap_xep, nap_cau_hinh
    from .vn import khoa_ho_ten

    cfg = cau_hinh or nap_cau_hinh()

    class _Sx:
        def __init__(self, d):
            self.ho_ten = d.ho_ten
            self.ma_khoa_goc = d.ma_khoa_goc

    ds = sorted(ds, key=lambda d: _khoa_sap_xep(_Sx(d), cfg["thu_tu_hang"]))
    _ = khoa_ho_ten  # dùng gián tiếp qua _khoa_sap_xep

    co_mp = cfg["cot_mac_dinh"]["H_co_mp"]
    bang = []
    for i, d in enumerate(ds, start=1):
        dong = [None] * 11
        dong[0] = i                       # A  SBD
        dong[1] = d.ho_ten                # B  Họ và Tên
        dong[2] = d.ngay_sinh             # C  Ngày Sinh
        dong[3] = d.cccd                  # D  CMND
        dong[4] = d.dia_chi               # E  Địa Chỉ
        dong[6] = d.ma_khoa_goc           # G  Ghi Chú = khóa gốc
        dong[7] = co_mp                   # H
        dong[8] = _gop(d.hang_gplx) or None   # I  Hạng GPLX đã có
        dong[9] = _gop(d.so_gplx) or None     # J  Số GPLX đã có
        dong[10] = d.ma_hoc_vien or None      # K  Mã học viên
        bang.append(dong)

    tom_tat = {}
    with excelcom.excel() as app:
        with excelcom.mo_ban_sao(app, file_mau, file_ra) as wb:
            ws, dong_header = excelcom.tim_sheet_chinh(wb)
            dau, cuoi = excelcom.vung_du_lieu(ws, dong_header)
            dau, cuoi = excelcom.chinh_so_dong(app, ws, dau, cuoi, len(bang))
            excelcom.dat_dinh_dang_chu(ws, dau, cuoi, [3, 4, 9, 10, 11])
            excelcom.ghi_khoi(ws, dau, bang)
            tom_tat["sua_tieu_de"] = excelcom.sua_tieu_de(
                ws, ma_khoa_dich, ngay_thi, bo_qua=(dau, cuoi)
            )
            tom_tat["xoa_sheet"] = excelcom.xoa_sheet_virus(wb)
            ws.Activate()
    tom_tat["so_dong"] = len(bang)
    return tom_tat
