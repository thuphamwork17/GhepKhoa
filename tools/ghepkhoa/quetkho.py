# -*- coding: utf-8 -*-
"""Quét hai kho hồ sơ trên máy 'thanh', dựng chỉ mục: mã khóa → file Báo cáo 1.

CHỈ ĐỌC. Không tạo, không sửa, không xóa bất cứ thứ gì trong kho.

Cấu trúc kho:
    <goc>\\<NAM yyyy>\\<Hang X>\\<thư mục khóa>\\bao cao 1-2\\Bao cao 1 ....xls

Tên thư mục khóa trong thực tế rất lộn xộn, nên chỉ bám vào hai thứ chắc chắn:

    * HẠNG   lấy từ tên thư mục cha ("Hang C1" → C1, "Hang B1" → B1)
    * SỐ KHÓA lấy từ tên thư mục khóa

Phần "SL …HV" và "KG …" trong tên thư mục bị bỏ qua hoàn toàn — chúng thiếu
năm, thiếu chữ, thừa dấu cách, có chỗ lặp "KG KG". Số liệu thật nằm trong nội
dung file Báo cáo 1 và đã được `baocao.py` đọc ra.

Vì sao phải ghép hạng từ thư mục cha: bên Trường, hạng B1 đặt tên thư mục chỉ
là "Khoa 100" — không có chữ B1 nào. Ghép lại mới ra đúng mã B1K100, và đó
cũng là lý do BK100 với B1K100 là hai khóa khác nhau chứ không phải gõ nhầm.
"""

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

from . import antoan

# Kho nào của đơn vị nào — mã cơ sở khớp với bảng DonVi trong SQL Server.
KHO = [
    {"ma_co_so": "92004", "ten": "Trung tâm Tây Đô", "goc": r"\\thanh\E\tay do"},
    {"ma_co_so": "92001", "ten": "Trường Cao đẳng Tây Đô", "goc": r"\\thanh\E\truong cao dang"},
]

_RE_NAM = re.compile(r"^n[ăa]m\s*(\d{4})$", re.IGNORECASE)
_RE_HANG = re.compile(r"^h[ạa]ng\s*([A-Za-zĐđ0-9-]+)$", re.IGNORECASE)
# Trong tên thư mục khóa, lấy số khóa. Hai dạng:
#   "Khoa C1K82 SL 80HV …" / "C1K52 SL80 …"  → có mã hạng dính liền chữ K
#   "Khoa 100 SL 40hv - KG 10-6"             → chỉ có số, hạng nằm ở thư mục cha
_RE_MA_DAY_DU = re.compile(r"\b([A-Za-zĐđ][A-Za-zĐđ0-9-]*)K\s*(\d{1,4})\b")
_RE_CHI_SO = re.compile(r"^\s*(?:kh[óo]a|khoa)\s+(\d{1,4})\b", re.IGNORECASE)
_RE_BAO_CAO_1 = re.compile(r"^b[áa]o?\s*cao\s*1\b.*\.xls$", re.IGNORECASE)


@dataclass
class KhoaTrenDia:
    ma_khoa: str
    hang: str
    so_khoa: int
    ma_co_so: str
    nam: int
    thu_muc: str
    file_bao_cao_1: str | None
    ten_thu_muc: str


def _doc_ma_khoa(ten_thu_muc: str, hang_cha: str):
    """Trả về (hạng, số khóa) hoặc (None, None) nếu không đọc được."""
    m = _RE_MA_DAY_DU.search(ten_thu_muc)
    if m:
        hang = m.group(1).upper().replace("Đ", "D") if False else m.group(1).upper()
        # "Khoa C1K82" → cụm trước K là "C1"; nhưng "Khoa" cũng khớp nếu tên là
        # "Khoa 100"? Không, vì dạng đó không có chữ K liền số.
        if hang in ("KHOA", "KHÓA"):
            m = None
        else:
            return hang, int(m.group(2))
    m2 = _RE_CHI_SO.match(ten_thu_muc)
    if m2 and hang_cha:
        return hang_cha.upper(), int(m2.group(1))
    return None, None


def _tim_bao_cao_1(thu_muc: Path):
    """File 'Bao cao 1 ….xls' nằm trong thư mục con 'bao cao 1-2'."""
    for con in thu_muc.iterdir():
        if not con.is_dir():
            continue
        if "bao cao" not in con.name.lower():
            continue
        ung = [f for f in con.iterdir() if f.is_file() and _RE_BAO_CAO_1.match(f.name)]
        if ung:
            # nhiều bản thì lấy bản mới nhất
            return max(ung, key=lambda f: f.stat().st_mtime)
    return None


def quet_mot_kho(goc: str, ma_co_so: str, canh_bao: list):
    ra = []
    g = Path(goc)
    if not g.is_dir():
        canh_bao.append(f"KHÔNG TRUY CẬP ĐƯỢC: {goc}")
        return ra

    for tm_nam in sorted(g.iterdir()):
        if not tm_nam.is_dir():
            continue
        m_nam = _RE_NAM.match(tm_nam.name.strip())
        if not m_nam:
            continue
        nam = int(m_nam.group(1))

        for tm_hang in sorted(tm_nam.iterdir()):
            if not tm_hang.is_dir():
                continue
            m_hang = _RE_HANG.match(tm_hang.name.strip())
            if not m_hang:
                continue
            hang_cha = m_hang.group(1).upper()

            for tm_khoa in sorted(tm_hang.iterdir()):
                if not tm_khoa.is_dir():
                    continue
                hang, so = _doc_ma_khoa(tm_khoa.name, hang_cha)
                if not hang or not so:
                    canh_bao.append(
                        f"KHÔNG ĐỌC ĐƯỢC MÃ KHÓA: {tm_khoa} — bỏ qua thư mục này."
                    )
                    continue
                if hang != hang_cha:
                    canh_bao.append(
                        f"LỆCH HẠNG: thư mục '{tm_khoa.name}' nằm trong '{tm_hang.name}' "
                        f"nhưng tên ghi hạng {hang}. Lấy theo tên thư mục khóa."
                    )
                try:
                    f = _tim_bao_cao_1(tm_khoa)
                except PermissionError:
                    canh_bao.append(f"KHÔNG CÓ QUYỀN ĐỌC: {tm_khoa}")
                    continue
                if f is None:
                    canh_bao.append(
                        f"THIẾU BÁO CÁO 1: {hang}K{so} — {tm_khoa} không có file 'Bao cao 1 ….xls'."
                    )
                ra.append(
                    KhoaTrenDia(
                        ma_khoa=f"{hang}K{so}",
                        hang=hang,
                        so_khoa=so,
                        ma_co_so=ma_co_so,
                        nam=nam,
                        thu_muc=str(tm_khoa),
                        file_bao_cao_1=str(f) if f else None,
                        ten_thu_muc=tm_khoa.name,
                    )
                )
    return ra


def quet(chi_ma_co_so=None):
    """Quét toàn bộ. Trả về (danh sách KhoaTrenDia, cảnh báo)."""
    canh_bao, tat_ca = [], []
    for k in KHO:
        if chi_ma_co_so and k["ma_co_so"] != chi_ma_co_so:
            continue
        tat_ca += quet_mot_kho(k["goc"], k["ma_co_so"], canh_bao)

    # Cùng một mã khóa xuất hiện ở nhiều thư mục trong CÙNG một cơ sở là dấu
    # hiệu thư mục bị nhân bản — phải báo, vì lấy nhầm là sai dữ liệu học viên.
    theo_khoa = {}
    for k in tat_ca:
        theo_khoa.setdefault((k.ma_co_so, k.ma_khoa), []).append(k)
    for (cs, ma), ds in theo_khoa.items():
        if len(ds) > 1:
            canh_bao.append(
                f"TRÙNG MÃ KHÓA {ma} ở cơ sở {cs}: "
                + " | ".join(x.ten_thu_muc for x in ds)
                + " — cần chỉ rõ dùng thư mục nào."
            )
    return tat_ca, canh_bao


def luu_chi_muc(ds, canh_bao, duong_dan=None):
    """Ghi chỉ mục ra thư mục làm việc trên Desktop (không bao giờ ghi vào kho)."""
    from datetime import datetime

    p = antoan.duong_dan_ghi(
        Path(duong_dan) if duong_dan else antoan.thu_muc_lam_viec() / "chi-muc-kho.json"
    )
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(
        json.dumps(
            {
                "quetLuc": datetime.now().isoformat(timespec="seconds"),
                "kho": KHO,
                "soKhoa": len(ds),
                "canhBao": canh_bao,
                "khoa": [asdict(k) for k in ds],
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    return p


def tra(ds, ma_khoa: str, ma_co_so: str | None = None):
    """Tìm khóa theo mã, giới hạn trong một cơ sở nếu có."""
    ma = re.sub(r"\s+", "", (ma_khoa or "").upper())
    ung = [k for k in ds if k.ma_khoa == ma and (not ma_co_so or k.ma_co_so == ma_co_so)]
    return ung
