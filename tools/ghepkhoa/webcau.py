# -*- coding: utf-8 -*-
"""Cầu nối giữa web (Next.js) và các module Python đã có sẵn.

Web không tự đọc database GPLX hay share hồ sơ — mọi việc đó vẫn do Python
làm, vì đã viết và kiểm thử ở đây rồi (dstn.py, quetkho.py, baocao.py). Web
chỉ gọi ra ngoài qua dòng lệnh, mỗi hàm ở module này in ĐÚNG MỘT DÒNG JSON ra
stdout để phía Node parse được, không lẫn với các dòng bảng biểu người đọc.
"""

import re
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from . import antoan, dstn, napdb, sqlrun
from .vn import bo_dau

MAY_CHU_DM = napdb.MAY_CHU_MD
CSDL_DM = napdb.CSDL_MD


def _sqlcmd_dm(script: str) -> str:
    """Chạy một script T-SQL trên DrivingManagement bằng Windows auth."""
    return sqlrun.chay_script(MAY_CHU_DM, CSDL_DM, script)


def _dd_mm_yyyy(iso: str) -> str:
    """'2026-08-23' -> '23/08/2026' — chỉ để hiện thông báo cho dễ đọc."""
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


def _ngay_yyyy_mm_dd(s):
    """'dd/mm/yyyy' hoặc 'yyyy-mm-dd' -> 'yyyy-mm-dd'. Rỗng/không đọc được -> None."""
    s = (s or "").strip()
    if not s:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return None


# ============================================================ đối chiếu 1 người

def _nap_ds_khoa(ma_khoa_goc: str, ma_co_so: str):
    """Toàn bộ học viên của một khóa cũ, tự chọn đúng nguồn theo cơ sở —
    dùng chung cho napmot() (đối chiếu 1 người) và goi_y() (gợi ý lúc gõ)."""
    if ma_co_so == "92004":
        return dstn.nap_khoa_tu_db(ma_khoa_goc)
    # 92001: ưu tiên tra thẳng database "cdtd" của Trường (CHITHANH) — chỉ
    # vào được khi máy đang chạy nằm trong mạng nội bộ của Trường. Không vào
    # được mạng đó thì rơi xuống DrivingManagement (bộ nhớ đệm nạp sẵn từ
    # Bao cao 1 qua lệnh 'napdb'), không chặn người dùng.
    try:
        ds_khoa = dstn.nap_khoa_tu_db_truong(ma_khoa_goc)
    except Exception:  # noqa: BLE001
        ds_khoa = None
    if not ds_khoa:
        ds_khoa = dstn.nap_khoa_tu_dm(ma_khoa_goc, ma_co_so)
    return ds_khoa


def napmot(vao: dict) -> dict:
    """Đối chiếu MỘT người đăng ký với hồ sơ khóa cũ, rồi upsert kết quả vào
    DrivingManagement — để lần sau tra thẳng trong đó, không phải chạy Python nữa.

    Trả về đủ dữ liệu để web hiển thị ngay, không cần đọc lại DB.
    """
    dang_ky_id = int(vao["dangKyId"])
    ho_ten = re.sub(r"\s+", " ", (vao.get("hoTen") or "").strip()).upper()
    ngay_sinh = _ngay_yyyy_mm_dd(vao.get("ngaySinh"))
    ma_khoa_goc = dstn.chuan_ma_khoa(vao.get("maKhoaGoc") or "")
    ma_co_so = str(vao.get("maCoSo") or "")

    if not ho_ten or not ma_khoa_goc or ma_co_so not in ("92001", "92004"):
        return {"ok": False, "ma": "THIEU_DU_LIEU", "thongBao": "Thiếu họ tên, mã khóa hoặc mã cơ sở."}

    try:
        ds_khoa = _nap_ds_khoa(ma_khoa_goc, ma_co_so)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "ma": "LOI_NGUON", "thongBao": f"Không đọc được nguồn dữ liệu: {e}"}

    if not ds_khoa:
        goi_y = ""
        if ma_co_so == "92001":
            try:
                if dstn.khoa_co_o_trung_tam(ma_khoa_goc):
                    goi_y = " Mã khóa này có trong dữ liệu Trung tâm (92004) — kiểm tra lại đã chọn đúng đợt của Trung tâm chưa."
            except Exception:  # noqa: BLE001
                pass
        return {
            "ok": False, "ma": "KHONG_CO_KHOA",
            "thongBao": f"Không có dữ liệu khóa {ma_khoa_goc} ở cơ sở {ma_co_so}.{goi_y}",
        }

    ten_can = bo_dau(ho_ten)
    ung = [x for x in ds_khoa if bo_dau(x["ho_ten"]) == ten_can]
    if ngay_sinh and len(ung) > 1:
        hep = [x for x in ung if _ngay_yyyy_mm_dd(x["ngay_sinh"]) == ngay_sinh]
        if hep:
            ung = hep

    if not ung:
        return {
            "ok": False, "ma": "KHONG_TIM_THAY",
            "thongBao": f"Không tìm thấy '{ho_ten}' trong khóa {ma_khoa_goc}.",
        }
    if len(ung) > 1:
        return {
            "ok": False, "ma": "TRUNG_TEN",
            "thongBao": f"Có {len(ung)} người tên '{ho_ten}' trong khóa {ma_khoa_goc} — "
                        "nhập thêm ngày sinh để phân biệt.",
            "candidates": [{"ngaySinh": x["ngay_sinh"], "cccd": x["cccd"]} for x in ung],
        }

    x = ung[0]
    cach = "TEN_NGAYSINH" if ngay_sinh else "CCCD"
    hang, so_khoa = napdb._tach(ma_khoa_goc)
    if not hang:
        return {"ok": False, "ma": "LOI", "thongBao": f"Không tách được mã khóa '{ma_khoa_goc}'."}

    # Điều kiện tốt nghiệp theo ngày bế giảng của khóa cũ, so với ngày thi
    # (ngày ghép) của đợt đang đăng ký — chỉ kiểm được khi biết cả hai ngày,
    # nguồn cũ không phải lúc nào cũng có NgayBG nên thiếu thì bỏ qua, không
    # chặn oan.
    ngay_thi = _ngay_yyyy_mm_dd(vao.get("ngayThi"))
    ngay_bg = _ngay_yyyy_mm_dd(x.get("ngay_be_giang"))
    if ngay_thi and ngay_bg:
        d_thi = date.fromisoformat(ngay_thi)
        d_bg = date.fromisoformat(ngay_bg)
        if d_bg > d_thi:
            return {
                "ok": False, "ma": "CHUA_BE_GIANG",
                "thongBao": (
                    f"Khóa {ma_khoa_goc} chưa bế giảng (dự kiến {_dd_mm_yyyy(ngay_bg)}) — "
                    f"chưa đủ điều kiện ghép vào đợt thi {_dd_mm_yyyy(ngay_thi)}."
                ),
            }
        if (d_thi - d_bg).days > 365:
            return {
                "ok": False, "ma": "QUA_HAN_MOT_NAM",
                "thongBao": (
                    f"Khóa {ma_khoa_goc} đã bế giảng {_dd_mm_yyyy(ngay_bg)}, quá 1 năm so với "
                    f"ngày ghép {_dd_mm_yyyy(ngay_thi)} — không còn được ghép khóa."
                ),
            }

    script = f"""SET NOCOUNT ON; SET XACT_ABORT ON; SET QUOTED_IDENTIFIER ON;
DECLARE @dv int = (SELECT DonViId FROM dbo.DonVi WHERE MaCoSo = '{ma_co_so}');
IF @dv IS NULL BEGIN RAISERROR(N'khong co don vi ma co so {ma_co_so}', 16, 1); RETURN; END
BEGIN TRAN;

MERGE dbo.Khoa AS t
USING (SELECT @dv AS DonViId, '{hang}' AS HangMa, {so_khoa} AS SoKhoa,
              {napdb._d(ngay_bg)} AS NgayBeGiang) AS n
   ON t.DonViId=n.DonViId AND t.HangMa=n.HangMa AND t.SoKhoa=n.SoKhoa
WHEN MATCHED AND n.NgayBeGiang IS NOT NULL AND t.NgayBeGiang IS NULL
     THEN UPDATE SET NgayBeGiang=n.NgayBeGiang
WHEN NOT MATCHED THEN INSERT (DonViId,HangMa,SoKhoa,NgayBeGiang)
     VALUES (n.DonViId,n.HangMa,n.SoKhoa,n.NgayBeGiang);
DECLARE @k int = (SELECT KhoaId FROM dbo.Khoa WHERE DonViId=@dv AND HangMa='{hang}' AND SoKhoa={so_khoa});

MERGE dbo.HocVien AS t
USING (SELECT {napdb._n(x['cccd'])} AS Cccd, {napdb._n(x['ho_ten'])} AS HoTen,
              {napdb._d(_ngay_yyyy_mm_dd(x['ngay_sinh']))} AS NgaySinh,
              {napdb._n(x['dia_chi'])} AS DiaChi, {napdb._n(x['so_gplx'])} AS SoGplx,
              {napdb._n(x['hang_gplx'])} AS HangGplx) AS n
   ON t.Cccd = n.Cccd
WHEN NOT MATCHED THEN INSERT (Cccd,HoTen,NgaySinh,NoiThuongTru,SoGplxDaCo,HangGplxDaCo)
     VALUES (n.Cccd,n.HoTen,n.NgaySinh,n.DiaChi,n.SoGplx,n.HangGplx);
DECLARE @hv int = (SELECT HocVienId FROM dbo.HocVien WHERE Cccd = {napdb._n(x['cccd'])});

MERGE dbo.HocVienKhoa AS t
USING (SELECT @k AS KhoaId, @hv AS HocVienId, {napdb._n(x.get('ma_hoc_vien'))} AS MaHocVien) AS n
   ON t.KhoaId=n.KhoaId AND t.HocVienId=n.HocVienId
WHEN MATCHED THEN UPDATE SET MaHocVien=n.MaHocVien, CapNhatLuc=SYSDATETIMEOFFSET()
WHEN NOT MATCHED THEN INSERT (KhoaId,HocVienId,MaHocVien,KetQuaTotNghiep)
     VALUES (n.KhoaId,n.HocVienId,n.MaHocVien,'VANG_THI');
DECLARE @hvk int = (SELECT HocVienKhoaId FROM dbo.HocVienKhoa WHERE KhoaId=@k AND HocVienId=@hv);

UPDATE dbo.DangKyGhepKhoa
   SET HocVienKhoaId=@hvk, CachKhop='{cach}', TrangThai='DUYET',
       NguoiDuyetId=NULL, DuyetLuc=SYSDATETIMEOFFSET(), CapNhatLuc=SYSDATETIMEOFFSET()
 WHERE DangKyId={dang_ky_id} AND TrangThai <> 'TU_CHOI';

COMMIT TRAN;
"""
    try:
        _sqlcmd_dm(script)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "ma": "LOI_LUU", "thongBao": f"Lỗi khi lưu vào cơ sở dữ liệu: {e}"}

    return {
        "ok": True,
        "cach": cach,
        "hoTen": x["ho_ten"],
        "ngaySinh": _ngay_yyyy_mm_dd(x["ngay_sinh"]) or "",
        "cccd": x["cccd"],
        "diaChi": x["dia_chi"],
        "hangGplx": x["hang_gplx"],
        "soGplx": x["so_gplx"],
        "maHocVien": x.get("ma_hoc_vien", ""),
        "maKhoaGoc": ma_khoa_goc,
    }


# ============================================================== gợi ý lúc gõ

def _tim_theo_ten_o_co_so(mot_phan: str, ma_co_so: str) -> list:
    if ma_co_so == "92004":
        return dstn.tim_theo_ten(mot_phan)
    try:
        ds = dstn.tim_theo_ten_truong(mot_phan)
    except Exception:  # noqa: BLE001
        ds = []
    return ds or dstn.tim_theo_ten_dm(mot_phan, ma_co_so)


def goi_y(vao: dict) -> dict:
    """Gợi ý tên + ngày sinh + khóa cũ khớp một phần họ tên đang gõ — KHÔNG
    cần biết trước mã khóa cũ, gõ tên trước là ra hết người trùng để chọn,
    chọn xong web tự điền luôn cả khóa cũ lẫn ngày sinh.

    Chủ động dò cả hai cơ sở nếu cơ sở đã chọn không ra kết quả — người gõ
    có thể chưa chọn đúng đợt, gợi ý vẫn nên xuất hiện nếu tìm thấy ở cơ sở
    còn lại (web sẽ tự có đủ khóa cũ để nhận ra có thể đang chọn nhầm đợt).
    """
    mot_phan = re.sub(r"\s+", " ", (vao.get("hoTen") or "").strip()).upper()
    ma_co_so = str(vao.get("maCoSo") or "")

    if len(mot_phan) < 2 or ma_co_so not in ("92001", "92004"):
        return {"ok": True, "ds": []}

    try:
        ds = _tim_theo_ten_o_co_so(mot_phan, ma_co_so)
        if not ds:
            ds = _tim_theo_ten_o_co_so(mot_phan, "92001" if ma_co_so == "92004" else "92004")
    except Exception:  # noqa: BLE001
        ds = []

    return {
        "ok": True,
        "ds": [
            {
                "hoTen": x["ho_ten"],
                "ngaySinh": _ngay_yyyy_mm_dd(x["ngay_sinh"]) or "",
                "maKhoaGoc": x["ma_khoa"],
            }
            for x in ds[:8]
        ],
    }


# ==================================================================== xuất file

def _dong_tu_dict(x):
    return SimpleNamespace(
        ho_ten=x.get("hoTen", ""),
        ngay_sinh=x.get("ngaySinh", ""),
        cccd=x.get("cccd") or "",
        dia_chi=x.get("diaChi") or "",
        ma_khoa_goc=x.get("maKhoaGoc", ""),
        hang_gplx=x.get("hangGplx") or "",
        so_gplx=x.get("soGplx") or "",
        ma_hoc_vien=x.get("maHocVien") or "",
    )


def xuatweb(vao: dict) -> dict:
    """Sinh file DS ghép khóa từ dữ liệu đã có sẵn trong DrivingManagement
    (web truyền sang dưới dạng JSON, không cần Python đọc lại DB/Excel)."""
    ma_khoa_dich = dstn.chuan_ma_khoa(vao.get("maKhoaDich") or "")
    file_mau = vao.get("fileMau") or ""
    rows = vao.get("rows") or []

    if not ma_khoa_dich:
        return {"ok": False, "loi": "Thiếu mã khóa đích."}
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", str(vao.get("ngayThi") or ""))
    if not m:
        return {"ok": False, "loi": "Ngày thi không hợp lệ."}
    ngay_thi = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    if not file_mau or not Path(file_mau).is_file():
        return {"ok": False, "loi": f"Không thấy file mẫu: {file_mau}"}
    if not rows:
        return {"ok": False, "loi": "Không có dòng nào để xuất — chưa ai được duyệt."}

    ds = [_dong_tu_dict(r) for r in rows]
    thu_muc = antoan.thu_muc_dot(ma_khoa_dich, ngay_thi)
    file_ra = thu_muc / f"DS ghép khóa TN VOI {ma_khoa_dich} {ngay_thi:%d-%m-%Y}.xls"

    try:
        tt = dstn.sinh_file(ds, ma_khoa_dich, ngay_thi, file_mau, file_ra)
    except antoan.ViPhamChiDoc as e:
        return {"ok": False, "loi": str(e)}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "loi": f"Lỗi khi sinh file: {e}"}

    return {"ok": True, "fileRa": str(file_ra), "soDong": tt["so_dong"]}
