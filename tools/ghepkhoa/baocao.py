# -*- coding: utf-8 -*-
"""Đọc file "Bao cao 1 <khóa>.xls".

Mỗi file có 2 sheet:
  BC1  — danh sách gốc toàn khóa
  bc2  — cùng danh sách nhưng đã tách ĐẠT (khối trên) / vắng thi (khối dưới)
         bởi một dòng mốc ghi chữ "vắng thi"

Cột trong BC1 (0-based):
  0 STT · 1 Họ tên · 2 Ngày sinh · 3 CCCD · 4 Nơi thường trú
  5 Số GPLX đã có · 6 Hạng GPLX đã có · 9 Mã học viên · 10 Ghi chú
Cột 10 (Ghi chú) chỉ được điền cho học viên chưa đạt, và giá trị của nó
chính là MÃ KHÓA sẽ ghép vào để thi lại.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path

import xlrd

from .vn import bo_dau

C_STT, C_TEN, C_NS, C_CCCD, C_DC, C_SOGPLX, C_HANG, C_MAHV, C_GHICHU = (
    0, 1, 2, 3, 4, 5, 6, 9, 10,
)

_RE_KHOA = re.compile(r"h[ạa]ng\s*:\s*(.+?)\s+kh[óo]a\s*:\s*(\d+)", re.IGNORECASE)
_RE_KHAI_GIANG = re.compile(r"khai\s*gi[ảa]ng\s*ng[àa]y\s*:\s*(\d{1,2})\D+(\d{1,2})\D+(\d{4})", re.I)
_RE_BE_GIANG = re.compile(r"b[ếe]\s*gi[ảa]ng\s*ng[àa]y\s*:\s*(\d{1,2})\D+(\d{1,2})\D+(\d{4})", re.I)
_RE_SO_NGAY = re.compile(r"th[ờo]i\s*gian\s*[đd][àa]o\s*t[ạa]o\s*:\s*(\d+)", re.I)
_RE_VAN_BAN = re.compile(r"v[ăa]n\s*b[ảa]n\s*s[ốo]\s*:?\s*(\S+)", re.I)
_RE_MA_CO_SO = re.compile(r"^(\d{4,6})-")


@dataclass
class HocVien:
    stt: int
    ho_ten: str
    ngay_sinh: str
    cccd: str
    dia_chi: str
    so_gplx: str
    hang_gplx: str
    ma_hoc_vien: str
    ghi_chu: str                 # mã khóa sẽ ghép vào (chỉ người chưa đạt mới có)
    ma_khoa_goc: str = ""        # suy từ tiêu đề file nguồn, ví dụ "C1K52"
    nguon: str = ""              # tên file nguồn
    dong: int = 0                # số dòng trong BC1 (1-based), để báo lỗi


@dataclass
class BaoCao:
    duong_dan: Path
    hang: str
    so_khoa: int
    hoc_vien: list = field(default_factory=list)
    cccd_dat: set = field(default_factory=set)
    cccd_vang: set = field(default_factory=set)
    ngay_khai_giang: str = ""    # yyyy-mm-dd
    ngay_be_giang: str = ""
    so_ngay_dao_tao: int = 0
    so_van_ban: str = ""

    @property
    def ma_khoa(self) -> str:
        return f"{self.hang}K{self.so_khoa}"

    @property
    def ma_co_so(self) -> str:
        """Mã cơ sở đào tạo, suy từ tiền tố mã học viên (92001-… / 92004-…).

        Đây là cách duy nhất phân biệt được file của Trường với file của Trung
        tâm: tiêu đề hai bên dùng font VNI khác nhau nên không so chuỗi được,
        còn mã học viên thì luôn mang mã cơ sở ở đầu.
        """
        dem = {}
        for hv in self.hoc_vien:
            m = _RE_MA_CO_SO.match(hv.ma_hoc_vien or "")
            if m:
                dem[m.group(1)] = dem.get(m.group(1), 0) + 1
        return max(dem, key=dem.get) if dem else ""


def _o(sheet, r, c):
    if c >= sheet.ncols or r >= sheet.nrows:
        return ""
    v = sheet.cell(r, c).value
    if isinstance(v, float):
        v = int(v) if v == int(v) else v
    return str(v).strip() if not isinstance(v, (int, float)) else v


def _txt(sheet, r, c):
    v = _o(sheet, r, c)
    return "" if v == "" else str(v).strip()


def _tim_sheet(book, tien_to):
    for ten in book.sheet_names():
        if ten.strip().lower().startswith(tien_to):
            return book.sheet_by_name(ten)
    return None


def _tim_dong_header(sheet):
    for r in range(min(sheet.nrows, 25)):
        if _txt(sheet, r, 0).upper() == "STT" and "TÊN" in _txt(sheet, r, 1).upper():
            return r
    raise ValueError("không tìm thấy dòng tiêu đề (STT / Họ và Tên)")


def _doc_tieu_de_khoa(sheet):
    for r in range(min(sheet.nrows, 12)):
        for c in range(min(sheet.ncols, 4)):
            m = _RE_KHOA.search(_txt(sheet, r, c))
            if m:
                return m.group(1).strip(), int(m.group(2))
    raise ValueError('không đọc được dòng "Học lái xe hạng: … Khóa: …"')


def _doc_thong_tin_khoa(sheet):
    """Ngày khai giảng / bế giảng / số ngày đào tạo / số văn bản ở đầu sheet."""
    chu = " \n".join(
        _txt(sheet, r, c) for r in range(min(sheet.nrows, 12)) for c in range(min(sheet.ncols, 4))
    )

    def ngay(rx):
        m = rx.search(chu)
        return f"{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else ""

    m_ngay = _RE_SO_NGAY.search(chu)
    m_vb = _RE_VAN_BAN.search(chu)
    return {
        "ngay_khai_giang": ngay(_RE_KHAI_GIANG),
        "ngay_be_giang": ngay(_RE_BE_GIANG),
        "so_ngay_dao_tao": int(m_ngay.group(1)) if m_ngay else 0,
        "so_van_ban": m_vb.group(1).strip("()") if m_vb else "",
    }


def _doc_danh_sach(sheet, dong_header):
    ra = []
    for r in range(dong_header + 1, sheet.nrows):
        stt = _o(sheet, r, C_STT)
        ten = _txt(sheet, r, C_TEN)
        if not isinstance(stt, int) or not ten:
            continue
        ra.append(
            HocVien(
                stt=stt,
                ho_ten=ten,
                ngay_sinh=_txt(sheet, r, C_NS),
                cccd=_txt(sheet, r, C_CCCD),
                dia_chi=_txt(sheet, r, C_DC),
                so_gplx=_txt(sheet, r, C_SOGPLX),
                hang_gplx=_txt(sheet, r, C_HANG),
                ma_hoc_vien=_txt(sheet, r, C_MAHV),
                ghi_chu=_txt(sheet, r, C_GHICHU),
                dong=r + 1,
            )
        )
    return ra


def _tach_dat_vang(sheet_bc2):
    """Trả về (set cccd đạt, set cccd vắng) dựa trên dòng mốc 'vắng thi'."""
    if sheet_bc2 is None:
        return set(), set()
    moc = None
    for r in range(sheet_bc2.nrows):
        hang_chu = " ".join(str(_o(sheet_bc2, r, c)) for c in range(sheet_bc2.ncols))
        if "VANG THI" in bo_dau(hang_chu):
            moc = r
            break
    dat, vang = set(), set()
    for r in range(sheet_bc2.nrows):
        if not isinstance(_o(sheet_bc2, r, C_STT), int):
            continue
        cccd = _txt(sheet_bc2, r, C_CCCD)
        if not cccd or not _txt(sheet_bc2, r, C_TEN):
            continue
        (vang if (moc is not None and r > moc) else dat).add(cccd)
    return dat, vang


def doc(duong_dan) -> BaoCao:
    p = Path(duong_dan)
    book = xlrd.open_workbook(str(p))
    bc1 = _tim_sheet(book, "bc1")
    if bc1 is None:
        raise ValueError(f"{p.name}: không có sheet BC1")
    hang, so_khoa = _doc_tieu_de_khoa(bc1)
    hv = _doc_danh_sach(bc1, _tim_dong_header(bc1))

    bc = BaoCao(
        duong_dan=p, hang=hang, so_khoa=so_khoa, hoc_vien=hv, **_doc_thong_tin_khoa(bc1)
    )
    for h in hv:
        h.ma_khoa_goc = bc.ma_khoa
        h.nguon = p.name

    bc2 = _tim_sheet(book, "bc2")
    bc.cccd_dat, bc.cccd_vang = _tach_dat_vang(bc2)
    return bc


def doc_thu_muc(thu_muc, mau_ten="Bao cao 1*.xls"):
    """Đọc mọi file Bao cao 1 trong thư mục. Trả về (danh sách BaoCao, danh sách lỗi)."""
    bao_caos, loi = [], []
    for p in sorted(Path(thu_muc).glob(mau_ten)):
        if p.name.startswith("~$"):
            continue
        try:
            bao_caos.append(doc(p))
        except Exception as e:  # noqa: BLE001 - gom lỗi để báo cáo, không dừng
            loi.append(f"{p.name}: {e}")
    return bao_caos, loi
