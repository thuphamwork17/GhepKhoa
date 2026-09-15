# -*- coding: utf-8 -*-
"""Đọc cấu hình kết nối database từ config.ini.

Đổi máy chủ/database/mật khẩu thì sửa config.ini, không sửa file này hay các
module gọi đến (dstn.py, napdb.py) — chúng chỉ đọc các hằng số bên dưới.
"""

import configparser
from pathlib import Path

_DUONG_DAN = Path(__file__).parent / "config.ini"

_cp = configparser.ConfigParser()
_da_doc = _cp.read(_DUONG_DAN, encoding="utf-8")
if not _da_doc:
    raise FileNotFoundError(f"Không thấy file cấu hình: {_DUONG_DAN}")


def _lay(muc: str, khoa: str, mac_dinh: str = "") -> str:
    return _cp.get(muc, khoa, fallback=mac_dinh).strip()


def _lay_hoac_none(muc: str, khoa: str):
    v = _lay(muc, khoa)
    return v or None


TRUNG_TAM_MAY_CHU = _lay("trung_tam", "may_chu", "localhost")
TRUNG_TAM_CSDL = _lay("trung_tam", "csdl", "GPLX_KhaoSat")
TRUNG_TAM_NGUOI_DUNG = _lay_hoac_none("trung_tam", "nguoi_dung")
TRUNG_TAM_MAT_KHAU = _lay_hoac_none("trung_tam", "mat_khau")

TRUONG_MAY_CHU = _lay("truong", "may_chu", r"CHITHANH\SQLEXPRESS")
TRUONG_CSDL = _lay("truong", "csdl", "cdtd")
TRUONG_NGUOI_DUNG = _lay_hoac_none("truong", "nguoi_dung")
TRUONG_MAT_KHAU = _lay_hoac_none("truong", "mat_khau")

WEB_MAY_CHU = _lay("web", "may_chu", r"ThuPham\SQLEXPRESS")
WEB_CSDL = _lay("web", "csdl", "DrivingManagement")
WEB_NGUOI_DUNG = _lay_hoac_none("web", "nguoi_dung")
WEB_MAT_KHAU = _lay_hoac_none("web", "mat_khau")
