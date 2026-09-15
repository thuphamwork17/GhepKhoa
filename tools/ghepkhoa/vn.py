# -*- coding: utf-8 -*-
"""Sắp xếp tên tiếng Việt theo đúng cách các file mẫu đang sắp.

Quy tắc rút ra từ file "DS ghép khóa TN VOI C1K82 18-07-2026.xls" và các
sheet BC1: so sánh theo TÊN (chữ cuối) trước, rồi tới HỌ (chữ đầu), rồi
CHỮ ĐỆM. Trong từng bậc so sánh theo 3 lớp:

  1. chữ cái đã bỏ hết dấu   ("ÂN" và "ANH" -> "AN" < "ANH")
  2. dấu thanh               (ngang < huyền < hỏi < ngã < sắc < nặng)
  3. dấu mũ / móc / chữ đ    (a < ă < â, o < ô < ơ, d < đ)
"""

import unicodedata

# ngang=0, huyền, hỏi, ngã, sắc, nặng
_THANH = {
    "̀": 1,  # huyền
    "̉": 2,  # hỏi
    "̃": 3,  # ngã
    "́": 4,  # sắc
    "̣": 5,  # nặng
}

# dấu phụ đổi chất nguyên âm
_PHU = {
    "̆": 1,  # ă
    "̂": 2,  # â ê ô
    "̛": 3,  # ơ ư
}


def _tach(s: str):
    """Trả về (chữ không dấu, chuỗi dấu thanh, chuỗi dấu phụ)."""
    goc, thanh, phu = [], [], []
    for ch in unicodedata.normalize("NFD", s):
        if ch in _THANH:
            thanh.append(_THANH[ch])
        elif ch in _PHU:
            phu.append(_PHU[ch])
        elif unicodedata.category(ch) == "Mn":
            continue
        elif ch in ("Đ", "đ"):
            goc.append("D")
            phu.append(4)
        else:
            goc.append(ch.upper())
    return "".join(goc), tuple(thanh), tuple(phu)


def khoa_tu(s: str):
    """Khóa sắp xếp cho một từ."""
    return _tach(s or "")


def bo_dau(s: str) -> str:
    """Bỏ toàn bộ dấu, viết hoa — dùng để dò lỗi gõ nhầm mã khóa."""
    return _tach(s or "")[0]


def khoa_ho_ten(ho_ten: str):
    """Khóa sắp xếp cho một họ tên đầy đủ: (tên, họ, đệm)."""
    tu = (ho_ten or "").split()
    if not tu:
        return (khoa_tu(""), khoa_tu(""), khoa_tu(""))
    ten = tu[-1]
    ho = tu[0] if len(tu) > 1 else ""
    dem = " ".join(tu[1:-1])
    return (khoa_tu(ten), khoa_tu(ho), khoa_tu(dem))
