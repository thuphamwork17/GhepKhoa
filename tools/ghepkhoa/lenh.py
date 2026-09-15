# -*- coding: utf-8 -*-
"""Hai lệnh chính của bộ công cụ."""

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

from . import baocao, dangky, excelcom
from .vn import bo_dau, khoa_ho_ten

GOC = Path(__file__).resolve().parent.parent

# cột trong sheet "du thi tn chinh thuc" (1-based, kiểu Excel)
A_SBD, B_TEN, C_NS, D_CCCD, E_DC, F_KITEN, G_KHOA, H_MP, I_HANG, J_GPLX, K_MAHV = range(1, 12)


def nap_cau_hinh(duong_dan=None):
    p = Path(duong_dan) if duong_dan else GOC / "cauhinh.json"
    return json.loads(p.read_text(encoding="utf-8"))


def _chuan(s):
    return re.sub(r"\s+", "", (s or "").strip().upper())


def _cung_file(a, b):
    """So sánh đường dẫn theo kiểu Windows (không phân biệt hoa/thường)."""
    return os.path.normcase(str(Path(a).resolve())) == os.path.normcase(str(Path(b).resolve()))


def _ten_khong_dung(thu_muc, ten, tranh):
    """Trả về đường dẫn chưa bị dùng và không trùng file mẫu.

    Trường hợp hay gặp: file mẫu trống lại đang mang đúng cái tên mà ta muốn
    đặt cho file kết quả (Windows không phân biệt hoa/thường nên sẽ đè mất
    bản gốc). Khi đó thêm hậu tố "(đã điền)".
    """
    goc, duoi = Path(ten).stem, Path(ten).suffix
    p = Path(thu_muc) / ten
    if not _cung_file(p, tranh) and not p.exists():
        return p
    p = Path(thu_muc) / f"{goc} (đã điền){duoi}"
    i = 2
    while _cung_file(p, tranh) or p.exists():
        p = Path(thu_muc) / f"{goc} (đã điền {i}){duoi}"
        i += 1
    return p


def _tach_ma_khoa(ma):
    """'C1K82' -> ('C1', 82).  'B-D2K247' -> ('B-D2', 247)."""
    m = re.match(r"^(.*?)K(\d+)$", _chuan(ma))
    return (m.group(1), int(m.group(2))) if m else (_chuan(ma), 0)


def _khoa_sap_xep(hv, thu_tu_hang):
    hang, so = _tach_ma_khoa(hv.ma_khoa_goc)
    try:
        uu_tien = thu_tu_hang.index(hang)
    except ValueError:
        uu_tien = len(thu_tu_hang)
    return (uu_tien, hang, so, khoa_ho_ten(hv.ho_ten))


# ============================================================ LỆNH 1: tạo DS

def tao_ds_ghep_khoa(thu_muc_nguon, khoa_dich, ngay_thi, file_mau,
                     file_ra=None, cau_hinh=None, chay_thu=False,
                     file_dang_ky=None, lay_ca_chua_duyet=False):
    """Dựng danh sách dự thi ghép khóa rồi đổ vào bản sao của `file_mau`.

    Có hai cách chọn người, tùy vào cách trung tâm đang làm việc:

    * mặc định — quét cột "Ghi chú" trong BC1 của mọi file "Bao cao 1 *.xls";
      ai được ghi mã khóa đích thì vào danh sách;
    * `file_dang_ky` — lấy danh sách người đã đăng ký trên web, rồi đối chiếu
      ngược lại với "Bao cao 1" để lấy dữ liệu chuẩn.

    Dù chọn cách nào, nội dung in ra văn bản luôn lấy từ "Bao cao 1".
    """
    cfg = cau_hinh or nap_cau_hinh()
    dich = [_chuan(k) for k in (khoa_dich if isinstance(khoa_dich, list) else [khoa_dich])]
    bao_caos, loi_doc = baocao.doc_thu_muc(thu_muc_nguon)

    canh_bao = list(loi_doc)
    if not bao_caos:
        raise SystemExit(f"Không đọc được file 'Bao cao 1 *.xls' nào trong {thu_muc_nguon}")

    moi_ma_khoa = Counter()
    for bc in bao_caos:
        for hv in bc.hoc_vien:
            if _chuan(hv.ghi_chu):
                moi_ma_khoa[_chuan(hv.ghi_chu)] += 1

    # ---- gom ứng viên -------------------------------------------------
    if file_dang_ky:
        ds_dk, cb1 = dangky.doc(file_dang_ky, chi_duyet=not lay_ca_chua_duyet)
        canh_bao += cb1
        lac = [n for n in ds_dk if n.khoa_dich and n.khoa_dich not in dich]
        if lac:
            canh_bao.append(
                f"BỎ QUA {len(lac)} người đăng ký đợt khác ("
                + ", ".join(sorted({n.khoa_dich for n in lac}))
                + ")."
            )
        ds_dk = [n for n in ds_dk if not n.khoa_dich or n.khoa_dich in dich]
        ung_vien, cb2 = dangky.doi_chieu(ds_dk, bao_caos)
        canh_bao += cb2
    else:
        ung_vien = []
        for bc in bao_caos:
            for hv in bc.hoc_vien:
                gc = _chuan(hv.ghi_chu)
                if not gc:
                    continue
                if gc in dich:
                    ung_vien.append(hv)
                elif cfg["kiem_tra"]["canh_bao_khoa_go_nham"] and any(
                    bo_dau(gc) == bo_dau(d) for d in dich
                ):
                    canh_bao.append(
                        f"GÕ NHẦM? {bc.duong_dan.name} dòng {hv.dong} ({hv.ho_ten}): "
                        f"ghi chú '{hv.ghi_chu}' chỉ khác dấu so với khóa đích {'/'.join(dich)} "
                        f"— chưa được đưa vào danh sách."
                    )

    # ---- kiểm tra dữ liệu ---------------------------------------------
    do_dai = cfg["kiem_tra"]["do_dai_cccd"]
    theo_cccd = defaultdict(list)
    for hv in ung_vien:
        theo_cccd[hv.cccd].append(hv)
    for cccd, ds in theo_cccd.items():
        if len(ds) > 1:
            canh_bao.append(
                "TRÙNG CCCD " + cccd + ": "
                + " | ".join(f"{h.ho_ten} ({h.nguon} dòng {h.dong})" for h in ds)
            )
    for hv in ung_vien:
        if not re.fullmatch(rf"\d{{{do_dai}}}", hv.cccd or ""):
            canh_bao.append(
                f"CCCD KHÔNG HỢP LỆ: {hv.ho_ten} ({hv.nguon} dòng {hv.dong}) = '{hv.cccd}'"
            )
        for ten_cot, gt in (("ngày sinh", hv.ngay_sinh), ("địa chỉ", hv.dia_chi)):
            if not gt:
                canh_bao.append(
                    f"THIẾU {ten_cot.upper()}: {hv.ho_ten} ({hv.nguon} dòng {hv.dong})"
                )
    if not file_dang_ky:
        # chỉ có nghĩa ở chế độ cột Ghi chú; chế độ đăng ký đã tự kiểm ở doi_chieu()
        for bc in bao_caos:
            for hv in bc.hoc_vien:
                if _chuan(hv.ghi_chu) in dich and hv.cccd in bc.cccd_dat:
                    canh_bao.append(
                        f"MÂU THUẪN: {hv.ho_ten} ({bc.duong_dan.name}) nằm trong khối ĐẠT của "
                        f"sheet bc2 nhưng vẫn bị đánh dấu ghép sang {hv.ghi_chu}."
                    )

    # ---- khử trùng + sắp xếp ------------------------------------------
    da_thay, ds = set(), []
    for hv in ung_vien:
        if hv.cccd in da_thay:
            continue
        da_thay.add(hv.cccd)
        ds.append(hv)
    ds.sort(key=lambda h: _khoa_sap_xep(h, cfg["thu_tu_hang"]))

    # ---- dựng bảng ghi ra ---------------------------------------------
    co_mp = cfg["cot_mac_dinh"]["H_co_mp"]
    ki_ten = cfg["cot_mac_dinh"]["F_ki_ten"]
    bang = []
    for i, hv in enumerate(ds, start=1):
        dong = [None] * 11
        dong[A_SBD - 1] = i
        dong[B_TEN - 1] = hv.ho_ten
        dong[C_NS - 1] = hv.ngay_sinh
        dong[D_CCCD - 1] = hv.cccd
        dong[E_DC - 1] = hv.dia_chi
        dong[F_KITEN - 1] = ki_ten or None
        dong[G_KHOA - 1] = hv.ma_khoa_goc
        dong[H_MP - 1] = co_mp
        dong[I_HANG - 1] = hv.hang_gplx or None
        dong[J_GPLX - 1] = hv.so_gplx or None
        dong[K_MAHV - 1] = hv.ma_hoc_vien or None
        bang.append(dong)

    tom_tat = {
        "nguon": [f"{bc.duong_dan.name} → {bc.ma_khoa} ({len(bc.hoc_vien)} HV, "
                  f"{len(bc.cccd_dat)} đạt / {len(bc.cccd_vang)} vắng)" for bc in bao_caos],
        "khoa_dich": dich,
        "so_thi_sinh": len(ds),
        "theo_khoa_goc": Counter(h.ma_khoa_goc for h in ds),
        "ma_khoa_khac_dang_cho": {k: v for k, v in sorted(moi_ma_khoa.items()) if k not in dich},
        "canh_bao": canh_bao,
    }

    if chay_thu or not bang:
        return None, ds, tom_tat

    # ---- ghi file ------------------------------------------------------
    ngay = ngay_thi
    if file_ra is None:
        ten = cfg["ten_file_ra"].format(khoa=dich[0], ngay=ngay.strftime("%d-%m-%Y"))
        # ghi cạnh các file Bao cao 1, không ghi vào thư mục chứa file mẫu
        file_ra = _ten_khong_dung(Path(thu_muc_nguon), ten, file_mau)
    file_ra = Path(file_ra).resolve()
    if _cung_file(file_ra, file_mau):
        raise SystemExit(
            "File ra trùng với file mẫu (Windows không phân biệt hoa/thường) — "
            "hãy đặt --ra sang tên khác để không đè bản gốc."
        )

    with excelcom.excel() as app:
        with excelcom.mo_ban_sao(app, file_mau, file_ra) as wb:
            ws, dong_header = excelcom.tim_sheet_chinh(wb)
            dau, cuoi = excelcom.vung_du_lieu(ws, dong_header)
            dau, cuoi = excelcom.chinh_so_dong(app, ws, dau, cuoi, len(bang))
            excelcom.dat_dinh_dang_chu(ws, dau, cuoi, [C_NS, D_CCCD, I_HANG, J_GPLX, K_MAHV])
            excelcom.ghi_khoi(ws, dau, bang)
            tom_tat["sua_tieu_de"] = excelcom.sua_tieu_de(ws, dich[0], ngay, bo_qua=(dau, cuoi))
            tom_tat["xoa_sheet"] = excelcom.xoa_sheet_virus(wb)
            ws.Activate()

    return file_ra, ds, tom_tat


# ============================================ LỆNH 2: cập nhật kết quả thi

_RE_CCCD = re.compile(r"^\d{9,12}$")


def doc_ds_dat(duong_dan):
    """Đọc danh sách đạt. Chấp nhận .txt (mỗi dòng 1 CCCD) hoặc .xls/.xlsx/.csv
    (tự dò cột nào chứa CCCD)."""
    p = Path(duong_dan)
    if p.suffix.lower() in (".txt",):
        return {d.strip() for d in p.read_text(encoding="utf-8").splitlines() if _RE_CCCD.match(d.strip())}

    o = []
    if p.suffix.lower() == ".csv":
        import csv
        with p.open(encoding="utf-8-sig", newline="") as f:
            o = list(csv.reader(f))
    elif p.suffix.lower() == ".xls":
        import xlrd
        bk = xlrd.open_workbook(str(p))
        for sh in bk.sheets():
            for r in range(sh.nrows):
                o.append([sh.cell(r, c).value for c in range(sh.ncols)])
    else:
        import openpyxl
        wb = openpyxl.load_workbook(str(p), data_only=True)
        for sh in wb.worksheets:
            for row in sh.iter_rows(values_only=True):
                o.append(list(row))

    ra = set()
    for hang in o:
        for v in hang:
            if isinstance(v, float) and v == int(v):
                v = int(v)
            s = str(v).strip() if v is not None else ""
            if _RE_CCCD.match(s):
                ra.add(s.zfill(12) if len(s) < 12 else s)
    return ra


def cap_nhat_ket_qua(file_ghep_khoa, ds_dat, file_ra=None, ten_sheet_dattn="DATTN"):
    """Tách danh sách dự thi thành ĐẠT (sheet DATTN, đánh lại số ở cột F)
    và VẮNG THI / chưa đạt (khối bên dưới), theo đúng cách file mẫu C1K82 làm.
    """
    dat = ds_dat if isinstance(ds_dat, set) else doc_ds_dat(ds_dat)
    src = Path(file_ghep_khoa).resolve()
    file_ra = Path(file_ra).resolve() if file_ra else src.with_name(src.stem + " (đã có KQ).xls")
    if _cung_file(file_ra, src):
        raise SystemExit("File ra trùng file vào — hãy đặt tên khác.")

    tom_tat = {}
    with excelcom.excel() as app:
        with excelcom.mo_ban_sao(app, src, file_ra) as wb:
            ws, dong_header = excelcom.tim_sheet_chinh(wb)
            dau, cuoi = excelcom.vung_du_lieu(ws, dong_header)
            vung = ws.Range(ws.Cells(dau, 1), ws.Cells(cuoi, K_MAHV)).Value
            hang = [list(r) for r in vung]

            def _s(v):
                if v is None:
                    return ""
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                return str(v).strip()

            do, khong = [], []
            for r in hang:
                (do if _s(r[D_CCCD - 1]) in dat else khong).append(r)

            # sheet DATTN: người đạt lên trên, đánh số mới ở cột F,
            # mã học viên dời từ cột K sang cột H (đúng như file mẫu)
            wsd = excelcom.nhan_ban_sheet(wb, ws, ten_sheet_dattn)

            # khối trên = người đạt; chữ ký phải nằm ngay sau khối này nên
            # danh sách vắng thi được đẩy xuống DƯỚI khối ký tên (như bản mẫu)
            bang = []
            for i, r in enumerate(do, start=1):
                m = list(r)
                m[F_KITEN - 1] = i
                m[H_MP - 1] = _s(r[K_MAHV - 1]) or None
                m[K_MAHV - 1] = None
                bang.append(m)

            d2, c2 = excelcom.vung_du_lieu(wsd, dong_header)
            d2, c2 = excelcom.chinh_so_dong(app, wsd, d2, c2, len(bang))
            excelcom.dat_dinh_dang_chu(wsd, d2, c2, [C_NS, D_CCCD, I_HANG, J_GPLX, K_MAHV])
            excelcom.ghi_khoi(wsd, d2, bang)

            if khong:
                dau_vang = excelcom.dong_cuoi_co_chu(wsd) + 2
                excelcom.dat_dinh_dang_chu(
                    wsd, dau_vang, dau_vang + len(khong),
                    [C_NS, D_CCCD, I_HANG, J_GPLX, K_MAHV],
                )
                excelcom.ghi_khoi(
                    wsd, dau_vang,
                    [["", "VẮNG THI"] + [None] * (K_MAHV - 2)] + [list(r) for r in khong],
                )

            excelcom.xoa_sheet_virus(wb)
            ws.Activate()

            tom_tat = {
                "tong": len(hang),
                "dat": len(do),
                "chua_dat": len(khong),
                "ds_chua_dat": [(_s(r[A_SBD - 1]), _s(r[B_TEN - 1]), _s(r[G_KHOA - 1])) for r in khong],
            }
    return file_ra, tom_tat


# ================================ LỆNH 3: xuất chỉ mục học viên ra JSON

def xuat_json(thu_muc_nguon, file_ra):
    """Xuất toàn bộ học viên trong các file "Bao cao 1 *.xls" ra một file JSON
    để web đăng ký dùng làm dữ liệu tra cứu.

    Web KHÔNG đọc trực tiếp .xls: phần bóc tách BIFF8 + tiêu đề font VNI đã
    được viết và kiểm thử ở đây rồi, nhân bản sang JavaScript chỉ tạo thêm
    một chỗ để sai lệch.
    """
    from datetime import datetime

    bao_caos, loi = baocao.doc_thu_muc(thu_muc_nguon)
    ds = []
    for bc in bao_caos:
        for hv in bc.hoc_vien:
            ds.append({
                "cccd": hv.cccd,
                "hoTen": hv.ho_ten,
                "tenKhongDau": bo_dau(hv.ho_ten),
                "ngaySinh": hv.ngay_sinh,
                "diaChi": hv.dia_chi,
                "hangGplx": hv.hang_gplx,
                "soGplx": hv.so_gplx,
                "maHocVien": hv.ma_hoc_vien,
                "maKhoaGoc": bc.ma_khoa,
                "trangThai": "dat" if hv.cccd in bc.cccd_dat else "chua_dat",
                "khoaDaGan": _chuan(hv.ghi_chu) or None,
                "nguon": hv.nguon,
                "dong": hv.dong,
            })

    goi = {
        "capNhat": datetime.now().isoformat(timespec="seconds"),
        "nguon": [
            {
                "file": bc.duong_dan.name,
                "maKhoa": bc.ma_khoa,
                "soHocVien": len(bc.hoc_vien),
                "soDat": len(bc.cccd_dat),
                "soVang": len(bc.cccd_vang),
            }
            for bc in bao_caos
        ],
        "loiDoc": loi,
        "hocVien": ds,
    }
    p = Path(file_ra)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(goi, ensure_ascii=False, indent=1), encoding="utf-8")
    return p, goi


# ============================================ LỆNH 4: dọn sheet virus

def don_virus(duong_dan, file_ra=None):
    src = Path(duong_dan).resolve()
    file_ra = Path(file_ra).resolve() if file_ra else src.with_name(src.stem + " (sach).xls")
    with excelcom.excel() as app:
        with excelcom.mo_ban_sao(app, src, file_ra) as wb:
            xoa = excelcom.xoa_sheet_virus(wb)
            wb.Sheets(1).Activate()
    if not xoa:
        Path(file_ra).unlink(missing_ok=True)
        return None, []
    return file_ra, xoa
