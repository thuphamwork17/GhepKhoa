# -*- coding: utf-8 -*-
"""Giao diện dòng lệnh.

  python -m ghepkhoa tao      --khoa BK100 --ngay 09/08/2026 [--thu ] ...
  python -m ghepkhoa ketqua   --file "DS ghép khóa ....xls" --dat dsdat.xlsx
  python -m ghepkhoa donvirus --file "....xls"
  python -m ghepkhoa gui
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

# Console Windows mặc định không phải UTF-8 (cp1252/cp437 tùy máy) — in tiếng
# Việt mà không ép encoding sẽ vỡ giữa chừng. Web gọi lệnh này qua subprocess
# nên phải tự chắc chắn được, không trông cậy PYTHONIOENCODING của người gọi.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass  # stdout/stderr đã bị thay (vd. chạy trong môi trường test) — bỏ qua

if __package__ in (None, ""):                      # cho phép chạy trực tiếp file
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    __package__ = "ghepkhoa"

from ghepkhoa import lenh  # noqa: E402

MAC_DINH_NGUON = Path(r"D:\GhepKhoa")


def _ngay(s):
    for f in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, f).date()
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"ngày không hợp lệ: {s} (dùng dd/mm/yyyy)")


def _mau_moi_nhat(thu_muc):
    """Tìm file mẫu.

    Ưu tiên thư mục con "Mau" — nếu quét cả thư mục làm việc thì rất dễ vớ
    phải một file DS đã điền của lần chạy trước và lấy nó làm khuôn.
    """
    for goc in (Path(thu_muc) / "Mau", Path(thu_muc)):
        ds = [
            p
            for p in goc.glob("DS ghép khóa*.xls")
            if not p.name.startswith("~$") and "(đã điền" not in p.name
        ]
        if ds:
            return max(ds, key=lambda p: p.stat().st_mtime)
    return None


def _in_bao_cao(tt, ds, file_ra):
    print()
    print("── NGUỒN " + "─" * 62)
    for d in tt["nguon"]:
        print("   " + d)
    print()
    print("── KẾT QUẢ " + "─" * 60)
    print(f"   Khóa đích      : {' + '.join(tt['khoa_dich'])}")
    print(f"   Số thí sinh    : {tt['so_thi_sinh']}")
    for k, v in sorted(tt["theo_khoa_goc"].items()):
        print(f"       {k:<12} {v:>3}")
    if tt["ma_khoa_khac_dang_cho"]:
        print()
        print("   Mã khóa khác đang chờ ghép (có trong nguồn nhưng không phải khóa đích):")
        for k, v in tt["ma_khoa_khac_dang_cho"].items():
            print(f"       {k:<12} {v:>3}")
    if tt.get("sua_tieu_de"):
        print()
        print("   Đã sửa tiêu đề / khối ký tên:")
        for _sh, r, c, cu, moi in tt["sua_tieu_de"]:
            print(f"       dòng {r} cột {c}: {cu}")
            print(f"                    → {moi}")
    if tt.get("xoa_sheet"):
        print(f"\n   ⚠ Đã xóa khỏi bản mới sheet virus: {', '.join(tt['xoa_sheet'])}")
    if tt["canh_bao"]:
        print()
        print("── CẢNH BÁO " + "─" * 59)
        for c in tt["canh_bao"]:
            print("   ! " + c)
    else:
        print("\n   Không có cảnh báo.")
    print()
    if file_ra:
        print(f"→ Đã ghi: {file_ra}")
    print()


def main(argv=None):
    ap = argparse.ArgumentParser(prog="ghepkhoa", description="Lập danh sách thi tốt nghiệp ghép khóa")
    sub = ap.add_subparsers(dest="lenh", required=True)

    t = sub.add_parser("tao", help="tạo danh sách dự thi ghép khóa")
    t.add_argument("--khoa", required=True, help="mã khóa đích, vd BK100 (nhiều mã cách nhau bởi dấu phẩy)")
    t.add_argument("--ngay", required=True, type=_ngay, help="ngày thi dd/mm/yyyy")
    t.add_argument("--nguon", default=str(MAC_DINH_NGUON), help="thư mục chứa các file 'Bao cao 1 *.xls'")
    t.add_argument("--mau", help="file .xls dùng làm mẫu (mặc định: file 'DS ghép khóa*.xls' mới nhất)")
    t.add_argument("--ra", help="đường dẫn file kết quả")
    t.add_argument("--thu", action="store_true", help="chỉ xem trước, không ghi file")
    t.add_argument("--dangky", help="file đăng ký tải từ web (.csv/.xlsx/.xls); "
                                    "bỏ trống thì lấy theo cột Ghi chú của BC1")
    t.add_argument("--ca-chua-duyet", action="store_true",
                   help="lấy cả người chưa được duyệt trong file đăng ký")

    k = sub.add_parser("ketqua", help="tách đạt / vắng thi sau khi có kết quả")
    k.add_argument("--file", required=True, help="file DS ghép khóa đã tạo")
    k.add_argument("--dat", required=True, help="file chứa danh sách đạt (.txt/.csv/.xls/.xlsx)")
    k.add_argument("--ra", help="đường dẫn file kết quả")

    d = sub.add_parser("donvirus", help="xóa sheet macro XL4Poppy khỏi một file")
    d.add_argument("--file", required=True)
    d.add_argument("--ra")

    n = sub.add_parser("napdb", help="nạp các file Bao cao 1 vào SQL Server")
    n.add_argument("--nguon", default=str(MAC_DINH_NGUON), help="thư mục chứa 'Bao cao 1 *.xls'")
    n.add_argument("--maychu", default="ThuPham\\SQLEXPRESS")
    n.add_argument("--csdl", default="DrivingManagement")
    n.add_argument("--coso", help="mã cơ sở mặc định khi file không có mã học viên (92001/92004)")
    n.add_argument("--thu", action="store_true", help="chỉ in script SQL, không chạy")

    qk = sub.add_parser("quetkho", help="quét kho hồ sơ trên máy 'thanh' (chỉ đọc)")
    qk.add_argument("--coso", help="chỉ quét một cơ sở: 92001 (Trường) hoặc 92004 (Trung tâm)")
    qk.add_argument("--ra", help="nơi lưu chỉ mục (mặc định: Desktop\\GhepKhoa\\chi-muc-kho.json)")
    qk.add_argument("--tim", help="in ra đường dẫn Báo cáo 1 của một mã khóa, ví dụ C1K84")

    nm = sub.add_parser("napmot", help="[web] đối chiếu 1 người rồi ghi vào DB — in JSON")
    nm.add_argument("--json", required=True, help="JSON: dangKyId, hoTen, ngaySinh, maKhoaGoc, maCoSo")

    xw = sub.add_parser("xuatweb", help="[web] sinh file DS ghép khóa từ dữ liệu đã có — in JSON")
    xw.add_argument("--json", required=True, help="JSON: maKhoaDich, ngayThi, fileMau, rows[]")

    gy = sub.add_parser("goiy", help="[web] gợi ý tên+ngày sinh khớp một phần lúc đang gõ — in JSON")
    gy.add_argument("--json", required=True, help="JSON: hoTen, maKhoaGoc, maCoSo")

    sub.add_parser("gui", help="mở giao diện bấm nút")

    a = ap.parse_args(argv)

    if a.lenh == "gui":
        from ghepkhoa.gui import chay
        return chay()

    if a.lenh == "tao":
        mau = a.mau or _mau_moi_nhat(a.nguon)
        if not mau:
            ap.error("không tìm thấy file mẫu 'DS ghép khóa*.xls' — hãy chỉ định --mau")
        print(f"Mẫu    : {mau}")
        print(f"Nguồn  : {a.nguon}")
        print(f"Chọn từ: {a.dangky if a.dangky else 'cột Ghi chú trong BC1'}")
        file_ra, ds, tt = lenh.tao_ds_ghep_khoa(
            a.nguon, a.khoa.split(","), a.ngay, mau, a.ra, chay_thu=a.thu,
            file_dang_ky=a.dangky, lay_ca_chua_duyet=a.ca_chua_duyet,
        )
        if a.thu:
            print("\n(chạy thử — không ghi file)\n")
            for i, hv in enumerate(ds, 1):
                print(f"  {i:>3}. {hv.ho_ten:<32} {hv.ngay_sinh:<11} {hv.cccd:<13} {hv.ma_khoa_goc}")
        _in_bao_cao(tt, ds, file_ra)
        return 0

    if a.lenh == "ketqua":
        file_ra, tt = lenh.cap_nhat_ket_qua(a.file, a.dat, a.ra)
        print(f"\n   Tổng dự thi : {tt['tong']}")
        print(f"   Đạt         : {tt['dat']}")
        print(f"   Chưa đạt    : {tt['chua_dat']}")
        for sbd, ten, khoa in tt["ds_chua_dat"]:
            print(f"       SBD {sbd:<4} {ten:<32} {khoa}")
        print(f"\n→ Đã ghi: {file_ra}\n")
        return 0

    if a.lenh == "quetkho":
        from ghepkhoa import antoan, quetkho

        print("Kho (CHỈ ĐỌC — không sửa/xóa gì trong đây):")
        for k in quetkho.KHO:
            if a.coso and k["ma_co_so"] != a.coso:
                continue
            print(f"   {k['ma_co_so']}  {k['ten']:<26} {k['goc']}")
        print("\nĐang quét…")
        ds, canh_bao = quetkho.quet(a.coso)

        if a.tim:
            ung = quetkho.tra(ds, a.tim)
            if not ung:
                print(f"\nKhông tìm thấy khóa {a.tim} trong kho.")
                return 1
            for k in ung:
                print(f"\n{k.ma_khoa} — cơ sở {k.ma_co_so} — năm {k.nam}")
                print(f"   thư mục   : {k.thu_muc}")
                print(f"   báo cáo 1 : {k.file_bao_cao_1 or '(không có)'}")
            return 0

        from collections import Counter
        print("\n── TÌM THẤY " + "─" * 59)
        dem = Counter((k.ma_co_so, k.hang) for k in ds)
        for (cs, hang), n in sorted(dem.items()):
            co_file = sum(1 for k in ds if k.ma_co_so == cs and k.hang == hang and k.file_bao_cao_1)
            print(f"   cơ sở {cs}  hạng {hang:<6} {n:>4} khóa  ({co_file} có Báo cáo 1)")
        print(f"   {'':>14}{'TỔNG':<6} {len(ds):>4} khóa")

        if canh_bao:
            print("\n── CẢNH BÁO " + "─" * 59)
            for c in canh_bao[:40]:
                print("   ! " + c)
            if len(canh_bao) > 40:
                print(f"   … và {len(canh_bao) - 40} cảnh báo nữa (xem trong file chỉ mục)")

        p = quetkho.luu_chi_muc(ds, canh_bao, a.ra)
        print(f"\n→ Chỉ mục: {p}")
        print(f"  Thư mục làm việc: {antoan.thu_muc_lam_viec()}")
        return 0

    if a.lenh == "napdb":
        from ghepkhoa import napdb
        kq, tom_tat, canh_bao, script, hang_can = napdb.chay(
            a.nguon, a.maychu, a.csdl, a.coso, chay_thu=a.thu
        )
        print("\n── NGUỒN " + "─" * 62)
        for t in tom_tat:
            print("   " + t)
        if hang_can:
            print(f"\n   Hạng GPLX cần có trong bảng HangGPLX: {', '.join(sorted(hang_can))}")
        if canh_bao:
            print("\n── CẢNH BÁO " + "─" * 59)
            for c in canh_bao:
                print("   ! " + c)
        if a.thu:
            print("\n── SCRIPT (chạy thử, không thực thi) " + "─" * 34)
            print(script)
            return 0
        print("\n── KẾT QUẢ " + "─" * 60)
        print(kq.stdout.strip())
        if kq.returncode != 0:
            print(kq.stderr.strip())
            print("\nNẠP THẤT BẠI — toàn bộ đã được rollback.")
            return kq.returncode
        print("\nĐã nạp xong.")
        return 0

    if a.lenh in ("napmot", "xuatweb", "goiy"):
        # Ba lệnh này dành cho web gọi qua subprocess: LUÔN in đúng một dòng
        # JSON ra stdout, kể cả khi lỗi — để Node parse đồng nhất, không phải
        # đoán định dạng theo mã thoát. Mọi thứ khác (nếu có) ra stderr.
        import json as _json

        from ghepkhoa import webcau
        _HAM = {"napmot": webcau.napmot, "xuatweb": webcau.xuatweb, "goiy": webcau.goi_y}
        try:
            dl = _json.loads(a.json)
            kq = _HAM[a.lenh](dl)
        except Exception as e:  # noqa: BLE001
            print(f"[loi] {a.lenh}: {e}", file=sys.stderr)
            kq = {"ok": False, "loi": str(e)}
        print(_json.dumps(kq, ensure_ascii=False))
        return 0

    if a.lenh == "donvirus":
        file_ra, xoa = lenh.don_virus(a.file, a.ra)
        print("Không thấy sheet virus." if not xoa else f"Đã xóa {xoa} → {file_ra}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
