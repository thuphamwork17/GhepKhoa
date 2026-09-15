import sys
sys.stdout.reconfigure(encoding='utf-8')
import openpyxl
from pathlib import Path
import re
import subprocess
import tempfile
import os

import os
sys.path.append(r"C:\Users\thupm\.gemini\antigravity-ide\brain\5348c15c-27bc-4e31-8b5f-9d426f1365e7\scratch")

from processor import process_course
from resolver import get_course_info

dir_tt = Path(r"C:\Users\thupm\OneDrive\Desktop\HỒ SƠ TRUNG TÂM")
dir_tr = Path(r"C:\Users\thupm\OneDrive\Desktop\HỒ SƠ TRƯỜNG")

def esc(s):
    if s is None or s == '':
        return "NULL"
    s = str(s).strip().replace("'", "''")
    return f"N'{s}'"

def esc_str(s):
    if s is None or s == '':
        return "NULL"
    s = str(s).strip().replace("'", "''")
    return f"'{s}'"

def num(v, default=0):
    try:
        if v is None or v == '': return default
        return int(float(v))
    except:
        return default

print("1. Scanning courses...")
courses_map = {}
for f in dir_tt.rglob("*.xls*"):
    if f.name.startswith("~$"): continue
    meta = get_course_info(f, "TRUNG_TAM")
    key = (meta[0], meta[5])
    if key not in courses_map: courses_map[key] = {"files": [], "meta": meta}
    courses_map[key]["files"].append(f)

for f in dir_tr.rglob("*.xls*"):
    if f.name.startswith("~$"): continue
    meta = get_course_info(f, "TRUONG")
    key = (meta[0], meta[5])
    if key not in courses_map: courses_map[key] = {"files": [], "meta": meta}
    courses_map[key]["files"].append(f)

print(f"Identified {len(courses_map)} courses.")

all_records = []
khoa_set = set()

for (org_code, ma_khoa), cdata in sorted(courses_map.items()):
    meta = cdata["meta"]
    don_vi_id = 1 if meta[0] == "92001" else 2
    hang_ma = "BSTD" if meta[3] in ("B(STĐ)", "BSTD", "B11") else meta[3]
    so_khoa = meta[4]
    
    khoa_set.add((don_vi_id, hang_ma, so_khoa, ma_khoa))
    
    st_list = process_course(cdata["files"], meta[0], meta[1], meta[2], meta[3], meta[4], meta[5])
    for s in st_list:
        s["don_vi_id"] = don_vi_id
        s["hang_ma"] = hang_ma
        s["so_khoa"] = so_khoa
        all_records.append(s)

print(f"Total students to insert: {len(all_records)}")

# Generate SQL script
sql_file_path = Path(r"d:\GhepKhoa\sql\import_ho_so_data.sql")
print(f"Writing SQL to {sql_file_path}...")

with open(sql_file_path, "w", encoding="utf-8-sig") as f:
    f.write("SET NOCOUNT ON;\nSET XACT_ABORT ON;\nSET ANSI_NULLS ON;\nSET QUOTED_IDENTIFIER ON;\nUSE DrivingManagement;\nGO\n\n")
    
    # Ensure Khoa records exist
    f.write("/* 1. Đảm bảo các khóa đào tạo tồn tại trong bảng Khoa */\n")
    for (dvi, hang, sokhoa, mkhoa) in sorted(khoa_set):
        f.write(f"""
IF NOT EXISTS (SELECT 1 FROM dbo.Khoa WHERE DonViId = {dvi} AND HangMa = '{hang}' AND SoKhoa = {sokhoa})
BEGIN
    INSERT INTO dbo.Khoa (DonViId, HangMa, SoKhoa, TrangThai)
    VALUES ({dvi}, '{hang}', {sokhoa}, 'CHO_THI');
END
""")
    f.write("GO\n\n")

    # Clear old HoSoHocVien if re-importing
    f.write("/* 2. Xóa dữ liệu cũ nếu đã nạp trước đó */\n")
    f.write("DELETE FROM dbo.LichSuHoSo;\n")
    f.write("DELETE FROM dbo.HoSoHocVien;\n")
    f.write("DBCC CHECKIDENT ('dbo.HoSoHocVien', RESEED, 0);\n")
    f.write("DBCC CHECKIDENT ('dbo.LichSuHoSo', RESEED, 0);\n")
    f.write("GO\n\n")

    # Insert HoSoHocVien in batches of 200
    batch_size = 200
    f.write("/* 3. Nạp danh sách học viên */\n")
    for i in range(0, len(all_records), batch_size):
        batch = all_records[i:i+batch_size]
        f.write("INSERT INTO dbo.HoSoHocVien (\n")
        f.write("  DonViId, HangMa, MaKhoa, KhoaId, HoTen, NgaySinh, Cccd, SoDienThoai, DiaChi, GiaoVien,\n")
        f.write("  MaHocVien, SoHoSo, SoHopDong, HocPhiSoTien, HocPhiTrangThai,\n")
        f.write("  CccdTrangThai, GiayKhamTrangThai, DonHocTrangThai, HopDongTrangThai, Hinh1MTrangThai, BangKhaiTrangThai, DatTrangThai,\n")
        f.write("  TrangThaiHoSo, ChiTietThieu, GhiChu, FileNguon\n")
        f.write(") VALUES\n")
        
        row_strs = []
        for s in batch:
            row_vals = [
                str(s["don_vi_id"]),
                esc_str(s["hang_ma"]),
                esc_str(s["ma_khoa"]),
                f"(SELECT KhoaId FROM dbo.Khoa WHERE DonViId={s['don_vi_id']} AND HangMa='{s['hang_ma']}' AND SoKhoa={s['so_khoa']})",
                esc(s["hoten"]),
                esc(s["ngaysinh"]),
                esc_str(s["cccd"]),
                esc(s["sdt"]),
                esc(s["diachi"]),
                esc(s["gv"]),
                esc_str(s["mahv"]),
                esc(s["sohs"]),
                esc_str(s["sohd"]),
                str(num(s["hocphi"])),
                esc_str(s["tt_hp"]),
                esc_str(s["tt_cccd"]),
                esc_str(s["tt_ksk"]),
                esc_str(s["tt_don"]),
                esc_str(s["tt_hd"]),
                esc_str(s["tt_1m"]),
                esc_str(s["tt_don"] if "nâng" in s["hang_ma"].lower() else "KHONG_CAN"),
                esc_str("CHUA_KIEM"),
                esc_str("DU" if s["ket_luan"] == "ĐỦ HỒ SƠ" else ("THIEU" if s["ket_luan"] == "THIẾU HỒ SƠ" else "CHUA_KIEM")),
                esc(s["danh_gia"] if "THIẾU" in s["ket_luan"] else None),
                esc(s["ghi_chu_goc"]),
                esc(s["nguon_goc"][:250] if s.get("nguon_goc") else None)
            ]
            row_strs.append("  (" + ", ".join(row_vals) + ")")
        f.write(",\n".join(row_strs) + ";\nGO\n\n")

    # Initial history log entries
    f.write("/* 4. Khởi tạo nhật ký lịch sử ban đầu */\n")
    f.write("""
INSERT INTO dbo.LichSuHoSo (HoSoId, HanhDong, TruongThayDoi, GiaTriMoi, GhiChu)
SELECT HoSoId, 'TAO_MOI', 'ToanBoHoSo', TrangThaiHoSo, N'Nạp ban đầu từ file chuẩn hóa'
FROM dbo.HoSoHocVien;
GO
""")

print("SQL script written successfully. Now running via sqlcmd...")
r = subprocess.run(
    ["sqlcmd", "-S", "ThuPham\\SQLEXPRESS", "-d", "DrivingManagement", "-E", "-i", str(sql_file_path), "-b", "-f", "65001"],
    capture_output=True, text=True, encoding="utf-8", errors="replace"
)

if r.returncode != 0:
    print(f"ERROR: {r.stderr or r.stdout}")
else:
    print("SUCCESS! All records imported.")
    
