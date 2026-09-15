# -*- coding: utf-8 -*-
"""Tự kiểm tra: đối chiếu logic của bộ công cụ với file mẫu có sẵn.

Chạy:  python tu_kiem_tra.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import xlrd  # noqa: E402

from ghepkhoa import baocao  # noqa: E402
from ghepkhoa.lenh import _khoa_sap_xep, _tach_ma_khoa, nap_cau_hinh  # noqa: E402
from ghepkhoa.vn import khoa_ho_ten  # noqa: E402

NGUON = Path(r"D:\GhepKhoa")
MAU_KQ = NGUON / "DS ghép khóa TN VOI C1K82 18-07-2026.xls"

loi = 0


def kt(ten, dieu_kien, chi_tiet=""):
    global loi
    print(("  OK   " if dieu_kien else "  SAI  ") + ten + (("  — " + chi_tiet) if chi_tiet else ""))
    if not dieu_kien:
        loi += 1


print("\n[1] Đọc file Bao cao 1")
for p, ma, n_hv, n_dat, n_vang in [
    ("Bao cao 1 c1k52.xls", "C1K52", 80, 16, 64),
    ("Bao cao 1 C1K53 2026.xls", "C1K53", 96, 54, 42),
    ("Bao cao 1 C1K82 TT 2026.xls", "C1K82", 80, 44, 36),
]:
    bc = baocao.doc(NGUON / p)
    kt(f"{p}: mã khóa = {ma}", bc.ma_khoa == ma, bc.ma_khoa)
    kt(f"{p}: {n_hv} học viên", len(bc.hoc_vien) == n_hv, str(len(bc.hoc_vien)))
    kt(f"{p}: {n_dat} đạt / {n_vang} vắng",
       (len(bc.cccd_dat), len(bc.cccd_vang)) == (n_dat, n_vang),
       f"{len(bc.cccd_dat)}/{len(bc.cccd_vang)}")

print("\n[2] Ghi chú chỉ xuất hiện ở người CHƯA đạt")
for p in ("Bao cao 1 c1k52.xls", "Bao cao 1 C1K82 TT 2026.xls"):
    bc = baocao.doc(NGUON / p)
    ro = [h.ho_ten for h in bc.hoc_vien if h.ghi_chu and h.cccd in bc.cccd_dat]
    kt(f"{p}: không ai vừa ĐẠT vừa có ghi chú ghép khóa", not ro, ", ".join(ro[:3]))

print("\n[3] Thứ tự sắp xếp khớp với file kết quả mẫu")
sh = xlrd.open_workbook(str(MAU_KQ)).sheet_by_name("du thi tn chinh thuc")
that = []
for r in range(5, sh.nrows):
    a = sh.cell(r, 0).value
    b = str(sh.cell(r, 1).value).strip()
    if isinstance(a, float) and a == int(a) and b:
        that.append((int(a), b, str(sh.cell(r, 6).value).strip()))
kt("đọc được 38 thí sinh từ file mẫu", len(that) == 38, str(len(that)))

cfg = nap_cau_hinh()


class _Gia:
    def __init__(self, ten, ma):
        self.ho_ten, self.ma_khoa_goc = ten, ma


tinh = sorted((_Gia(t, k) for _, t, k in that), key=lambda h: _khoa_sap_xep(h, cfg["thu_tu_hang"]))
lech = [(i, a[1], b.ho_ten) for i, (a, b) in enumerate(zip(that, tinh), 1) if a[1] != b.ho_ten]
kt(f"sắp xếp lại 38 dòng khớp {38 - len(lech)}/38", len(lech) <= 2,
   "; ".join(f"#{i}: mẫu={x} / tính={y}" for i, x, y in lech))
if lech:
    print("       (chênh lệch là các ngoại lệ nhập tay đã biết, xem README)")

print("\n[4] Thứ tự nhóm khóa")
nhom = []
for _, _, k in that:
    if k not in nhom:
        nhom.append(k)
nhom_tinh = []
for h in tinh:
    if h.ma_khoa_goc not in nhom_tinh:
        nhom_tinh.append(h.ma_khoa_goc)
kt("thứ tự nhóm khóa giống hệt file mẫu", nhom == nhom_tinh, f"{nhom_tinh}")

print("\n[5] Tách mã khóa")
for ma, mong in [("C1K82", ("C1", 82)), ("B-D2K247", ("B-D2", 247)),
                 ("BK134", ("B", 134)), ("CEK143", ("CE", 143))]:
    kt(f"{ma} → {mong}", _tach_ma_khoa(ma) == mong, str(_tach_ma_khoa(ma)))

print("\n[6] Sắp xếp tên tiếng Việt")
for a, b, mo_ta in [("LÊ TÂN SÁNG", "TRƯƠNG MINH SANG", "SANG (ngang) trước SÁNG (sắc)"),
                    ("NGÔ QUANG ANH", "LÊ VĂN ÂN", "ÂN trước ANH (bỏ dấu: an < anh)"),
                    ("NGUYỄN THANH DANH", "NGUYỄN MINH ĐĂNG", "ĐĂNG trước DANH")]:
    kt(mo_ta, khoa_ho_ten(b) < khoa_ho_ten(a))

print("\n" + ("Tất cả đều đạt." if loi == 0 else f"{loi} mục SAI."))
sys.exit(1 if loi else 0)
