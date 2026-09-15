# -*- coding: utf-8 -*-
# Docstring để dạng raw: bên trong có đường dẫn UNC, không thì \E, \t… bị Python
# hiểu thành ký tự thoát và bắn SyntaxWarning.
r"""Hàng rào bảo vệ kho file gốc.

Hai thư mục dùng chung trên máy `thanh` là hồ sơ gốc của trung tâm và trường.
Toàn bộ code trong gói này chỉ được phép ĐỌC chúng. Mọi thao tác ghi — kể cả
tạo file mới, kể cả SaveAs của Excel — đều phải đi qua `duong_dan_ghi()` và sẽ
bị chặn nếu đích nằm trong vùng cấm.

Chặn ở đây là chặn theo đường dẫn đã chuẩn hóa, nên đi vòng bằng "..", bằng ký
tự hoa/thường khác nhau, hay bằng ổ đĩa đã ánh xạ (net use Z: \\thanh\E) đều
không lách được.
"""

import os
import re
import shutil
from datetime import date
from pathlib import Path, PurePath

# Vùng cấm ghi. Thêm bớt ở đây, không rải rác trong code.
KHO_CHI_DOC = [
    r"\\thanh\E\tay do",
    r"\\thanh\E\truong cao dang",
]

TEN_THU_MUC_LAM_VIEC = "GhepKhoa"


class ViPhamChiDoc(Exception):
    """Ném ra khi có chỗ nào định ghi vào kho gốc."""


def _chuan(p) -> str:
    """Chuẩn hóa đường dẫn để so sánh: tuyệt đối, bỏ '..', không phân biệt hoa thường."""
    return os.path.normcase(os.path.abspath(str(p)))


def _cac_goc_cam() -> list:
    goc = [_chuan(p) for p in KHO_CHI_DOC]
    # Nếu kho được ánh xạ thành ổ đĩa (Z: -> \\thanh\E) thì chặn cả lối đó.
    try:
        import subprocess

        kq = subprocess.run(
            ["net", "use"], capture_output=True, text=True, encoding="utf-8", errors="replace"
        )
        for d in re.finditer(r"([A-Za-z]:)\s+(\\\\[^\s]+)", kq.stdout or ""):
            o, unc = d.group(1), d.group(2)
            for k in KHO_CHI_DOC:
                if _chuan(k).startswith(_chuan(unc)):
                    goc.append(_chuan(k.replace(unc, o, 1)))
    except Exception:
        pass  # không dò được ổ ánh xạ thì vẫn còn lớp chặn theo UNC
    return goc


_GOC_CAM = None


def trong_kho_goc(p) -> bool:
    """True nếu đường dẫn nằm trong một kho chỉ đọc."""
    global _GOC_CAM
    if _GOC_CAM is None:
        _GOC_CAM = _cac_goc_cam()
    c = _chuan(p)
    return any(c == g or c.startswith(g + os.sep) for g in _GOC_CAM)


def duong_dan_ghi(p) -> Path:
    """Cổng duy nhất để lấy đường dẫn sắp ghi. Ném lỗi nếu đích nằm trong kho gốc."""
    if trong_kho_goc(p):
        raise ViPhamChiDoc(
            f"Từ chối ghi vào kho hồ sơ gốc: {p}\n"
            "Kho trên máy 'thanh' chỉ được đọc. Hãy ghi ra thư mục làm việc trên Desktop."
        )
    return Path(p)


def thu_muc_lam_viec(tao=True) -> Path:
    """Thư mục làm việc trên Desktop — nơi duy nhất được ghi kết quả."""
    d = Path(os.path.expanduser("~")) / "Desktop"
    od = os.environ.get("OneDrive")
    if od and (Path(od) / "Desktop").is_dir():
        d = Path(od) / "Desktop"
    p = d / TEN_THU_MUC_LAM_VIEC
    if tao:
        p.mkdir(parents=True, exist_ok=True)
    return p


def thu_muc_dot(ma_khoa: str, ngay: date | None = None, tao=True) -> Path:
    """Thư mục riêng cho một đợt ghép khóa, ví dụ …\\Desktop\\GhepKhoa\\BK100 09-08-2026."""
    ten = re.sub(r"[^A-Za-z0-9ĐĐ_-]", "", (ma_khoa or "KHONG_RO").upper())
    if ngay:
        ten += " " + ngay.strftime("%d-%m-%Y")
    p = thu_muc_lam_viec(tao) / ten
    if tao:
        p.mkdir(parents=True, exist_ok=True)
    return p


def chep_ra_desktop(nguon, thu_muc_dich=None, ten_moi=None) -> Path:
    """Chép một file từ kho gốc ra thư mục làm việc để sửa trên bản sao.

    Không bao giờ chép đè: nếu đích đã có thì thêm hậu tố (2), (3)…
    """
    nguon = Path(nguon)
    if not nguon.is_file():
        raise FileNotFoundError(f"Không thấy file nguồn: {nguon}")

    dich_tm = Path(thu_muc_dich) if thu_muc_dich else thu_muc_lam_viec()
    duong_dan_ghi(dich_tm).mkdir(parents=True, exist_ok=True)

    ten = ten_moi or nguon.name
    dich = dich_tm / ten
    i = 2
    while dich.exists():
        dich = dich_tm / f"{PurePath(ten).stem} ({i}){PurePath(ten).suffix}"
        i += 1

    shutil.copy2(str(nguon), str(duong_dan_ghi(dich)))
    return dich
