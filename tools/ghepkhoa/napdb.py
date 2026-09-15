# -*- coding: utf-8 -*-
"""Nạp dữ liệu từ các file "Bao cao 1 *.xls" vào SQL Server.

Nạp vào ba bảng: Khoa, HocVien, HocVienKhoa. Sau bước này web mới đối chiếu
được người đăng ký với hồ sơ khóa cũ.

Chạy qua sqlcmd bằng Windows auth, không cần TCP/IP hay login SQL — tiện cho
việc chạy tay trên máy đặt SQL Server.

Nạp lại nhiều lần được: mọi thứ đều MERGE theo khóa tự nhiên (mã khóa, CCCD).
"""

import re
from dataclasses import dataclass

from . import baocao, config, sqlrun

# Máy chủ/database lấy từ config.ini — đổi ở đó, không đổi ở đây.
MAY_CHU_MD = config.WEB_MAY_CHU
CSDL_MD = config.WEB_CSDL


def _n(s):
    """Chuỗi thành literal N'...' cho T-SQL, NULL nếu rỗng."""
    if s is None or str(s).strip() == "":
        return "NULL"
    return "N'" + str(s).strip().replace("'", "''") + "'"


def _d(s):
    """Ngày yyyy-mm-dd thành literal, NULL nếu rỗng."""
    return f"'{s}'" if s else "NULL"


def _so(v):
    return str(int(v)) if v else "NULL"


_RE_MA_KHOA = re.compile(r"^(.*?)K(\d+)$")


def _tach(ma):
    m = _RE_MA_KHOA.match(re.sub(r"\s+", "", (ma or "").upper()))
    return (m.group(1), int(m.group(2))) if m else (None, None)


def dung_script(bao_caos, mac_dinh_co_so=None):
    """Sinh script T-SQL nạp toàn bộ dữ liệu. Trả về (script, cảnh báo)."""
    ra = [
        "SET NOCOUNT ON;",
        "SET XACT_ABORT ON;",
        "SET QUOTED_IDENTIFIER ON;",  # bảng Khoa có index trên cột tính sẵn
        # Khai báo một lần cho cả batch: T-SQL không cho DECLARE trùng tên,
        # dù các lần khai báo nằm ở những đoạn rời nhau.
        "DECLARE @dv int, @k int;",
        "BEGIN TRAN;",
    ]
    canh_bao = []
    hang_can = set()

    for bc in bao_caos:
        ma_co_so = bc.ma_co_so or mac_dinh_co_so
        if not ma_co_so:
            canh_bao.append(
                f"BỎ QUA {bc.duong_dan.name}: không đoán được mã cơ sở từ mã học viên "
                "(cột J của BC1 trống). Dùng --coso để chỉ định."
            )
            continue

        hang_can.add(bc.hang.upper())
        ra += [
            "",
            f"/* ===== {bc.duong_dan.name} → {bc.ma_khoa} (cơ sở {ma_co_so}) ===== */",
            f"SET @dv = (SELECT DonViId FROM dbo.DonVi WHERE MaCoSo = '{ma_co_so}');",
            f"IF @dv IS NULL RAISERROR(N'Khong co don vi ma co so {ma_co_so}', 16, 1);",
            "",
            "MERGE dbo.Khoa AS t",
            f"USING (SELECT @dv AS DonViId, '{bc.hang.upper()}' AS HangMa, {bc.so_khoa} AS SoKhoa) AS n",
            "   ON t.DonViId = n.DonViId AND t.HangMa = n.HangMa AND t.SoKhoa = n.SoKhoa",
            "WHEN MATCHED THEN UPDATE SET",
            f"     NgayKhaiGiang = {_d(bc.ngay_khai_giang)}, NgayBeGiang = {_d(bc.ngay_be_giang)},",
            f"     SoNgayDaoTao = {_so(bc.so_ngay_dao_tao)}, SoVanBan = {_n(bc.so_van_ban)},",
            f"     NguonNhap = {_n(bc.duong_dan.name)}, CapNhatLuc = SYSDATETIMEOFFSET()",
            "WHEN NOT MATCHED THEN INSERT",
            "     (DonViId, HangMa, SoKhoa, NgayKhaiGiang, NgayBeGiang, SoNgayDaoTao, SoVanBan, NguonNhap)",
            f"     VALUES (@dv, '{bc.hang.upper()}', {bc.so_khoa}, {_d(bc.ngay_khai_giang)},",
            f"             {_d(bc.ngay_be_giang)}, {_so(bc.so_ngay_dao_tao)}, {_n(bc.so_van_ban)},",
            f"             {_n(bc.duong_dan.name)});",
            "",
            f"SET @k = (SELECT KhoaId FROM dbo.Khoa WHERE DonViId=@dv AND MaKhoa='{bc.ma_khoa}');",
        ]

        # ---- học viên ------------------------------------------------
        hop_le = []
        for hv in bc.hoc_vien:
            cccd = hv.cccd or ""
            # Excel lưu CCCD thành số thì số 0 đứng đầu bị mất. Ba chữ số đầu
            # của CCCD là mã tỉnh (001–096) nên chuỗi 11 số gần như chắc chắn
            # là đã rụng đúng một số 0 — bù lại rồi báo để người dùng đối chiếu.
            if re.fullmatch(r"\d{11}", cccd):
                cccd = "0" + cccd
                canh_bao.append(
                    f"BÙ SỐ 0: {bc.duong_dan.name} dòng {hv.dong} ({hv.ho_ten}): "
                    f"CCCD '{hv.cccd}' chỉ có 11 số, đã nạp thành '{cccd}'. "
                    "Nên sửa lại trong file gốc cho khớp."
                )
                hv.cccd = cccd
            if not re.fullmatch(r"\d{12}", cccd):
                canh_bao.append(
                    f"BỎ QUA {bc.duong_dan.name} dòng {hv.dong} ({hv.ho_ten}): "
                    f"CCCD '{hv.cccd}' không đủ 12 chữ số."
                )
                continue
            hop_le.append(hv)

        # khử trùng CCCD trong cùng một khóa (UNIQUE (KhoaId, HocVienId))
        da_thay, ds = set(), []
        for hv in hop_le:
            if hv.cccd in da_thay:
                canh_bao.append(
                    f"TRÙNG trong {bc.duong_dan.name}: {hv.ho_ten} — {hv.cccd} "
                    f"xuất hiện lần nữa ở dòng {hv.dong}, chỉ lấy lần đầu."
                )
                continue
            da_thay.add(hv.cccd)
            ds.append(hv)

        if not ds:
            continue

        # HocVien: MERGE theo CCCD. Không đè tên/địa chỉ nếu đã có — bản ghi
        # cũ có thể đã được cán bộ sửa tay cho đúng.
        for lo in _chia_lo(ds, 200):
            gt = ",\n  ".join(
                f"({_n(h.cccd)}, {_n(h.ho_ten)}, {_d(_ngay(h.ngay_sinh))}, {_n(h.dia_chi)}, "
                f"{_n(h.so_gplx)}, {_n(h.hang_gplx)})"
                for h in lo
            )
            ra += [
                "",
                "MERGE dbo.HocVien AS t",
                f"USING (VALUES\n  {gt}) AS n (Cccd, HoTen, NgaySinh, NoiThuongTru, SoGplx, HangGplx)",
                "   ON t.Cccd = n.Cccd",
                "WHEN NOT MATCHED THEN INSERT (Cccd, HoTen, NgaySinh, NoiThuongTru, SoGplxDaCo, HangGplxDaCo)",
                "     VALUES (n.Cccd, n.HoTen, n.NgaySinh, n.NoiThuongTru, n.SoGplx, n.HangGplx);",
            ]

        # HocVienKhoa: kết quả tốt nghiệp + khóa được đánh dấu ghép sang
        for lo in _chia_lo(ds, 200):
            gt = ",\n  ".join(
                f"({_n(h.cccd)}, {h.stt}, {_n(h.ma_hoc_vien)}, "
                f"'{'DAT' if h.cccd in bc.cccd_dat else 'VANG_THI'}', {_n(h.ghi_chu)})"
                for h in lo
            )
            ra += [
                "",
                "MERGE dbo.HocVienKhoa AS t",
                f"USING (SELECT hv.HocVienId, n.SoThuTu, n.MaHocVien, n.KetQua,",
                "              KhoaGhepToiId = (SELECT TOP 1 k2.KhoaId FROM dbo.Khoa k2",
                "                                WHERE k2.DonViId = @dv AND k2.MaKhoa = n.GhiChu)",
                f"         FROM (VALUES\n  {gt}) AS n (Cccd, SoThuTu, MaHocVien, KetQua, GhiChu)",
                "         JOIN dbo.HocVien hv ON hv.Cccd = n.Cccd) AS n",
                "   ON t.KhoaId = @k AND t.HocVienId = n.HocVienId",
                "WHEN MATCHED THEN UPDATE SET",
                "     SoThuTu = n.SoThuTu, MaHocVien = n.MaHocVien,",
                "     KetQuaTotNghiep = n.KetQua,",
                "     KhoaGhepToiId = CASE WHEN n.KetQua = 'DAT' THEN NULL ELSE n.KhoaGhepToiId END,",
                "     CapNhatLuc = SYSDATETIMEOFFSET()",
                "WHEN NOT MATCHED THEN INSERT (KhoaId, HocVienId, SoThuTu, MaHocVien, KetQuaTotNghiep, KhoaGhepToiId)",
                "     VALUES (@k, n.HocVienId, n.SoThuTu, n.MaHocVien, n.KetQua,",
                "             CASE WHEN n.KetQua = 'DAT' THEN NULL ELSE n.KhoaGhepToiId END);",
            ]

    ra += [
        "",
        "COMMIT TRAN;",
        "",
        "SELECT k.MaKhoa, d.TenVietTat, SoHocVien = COUNT(*),",
        "       SoDat  = SUM(CASE WHEN hvk.KetQuaTotNghiep = 'DAT' THEN 1 ELSE 0 END),",
        "       SoVang = SUM(CASE WHEN hvk.KetQuaTotNghiep <> 'DAT' THEN 1 ELSE 0 END),",
        "       SoDaGan = SUM(CASE WHEN hvk.KhoaGhepToiId IS NOT NULL THEN 1 ELSE 0 END)",
        "  FROM dbo.HocVienKhoa hvk",
        "  JOIN dbo.Khoa k ON k.KhoaId = hvk.KhoaId",
        "  JOIN dbo.DonVi d ON d.DonViId = k.DonViId",
        " GROUP BY k.MaKhoa, d.TenVietTat ORDER BY d.TenVietTat, k.MaKhoa;",
    ]
    return "\n".join(ra), canh_bao, hang_can


def _chia_lo(ds, n):
    for i in range(0, len(ds), n):
        yield ds[i : i + n]


@dataclass
class _KetQuaChay:
    """Giữ đúng hình dạng subprocess.CompletedProcess mà __main__.py đang đọc
    (.stdout/.stderr/.returncode) — đổi nguồn chạy nhưng không phải sửa CLI."""
    stdout: str
    stderr: str
    returncode: int


def _ngay(s):
    """'22/07/2004' -> '2004-07-22'. Trả về '' nếu không đọc được."""
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$", s or "")
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else ""


def chay(thu_muc_nguon, may_chu=MAY_CHU_MD, csdl=CSDL_MD, mac_dinh_co_so=None, chay_thu=False):
    bao_caos, loi = baocao.doc_thu_muc(thu_muc_nguon)
    if not bao_caos:
        raise SystemExit(f"Không đọc được file 'Bao cao 1 *.xls' nào trong {thu_muc_nguon}")

    script, canh_bao, hang_can = dung_script(bao_caos, mac_dinh_co_so)
    canh_bao = loi + canh_bao

    tom_tat = [
        f"{bc.duong_dan.name} → {bc.ma_khoa} (cơ sở {bc.ma_co_so or '?'}) : "
        f"{len(bc.hoc_vien)} HV, {len(bc.cccd_dat)} đạt / {len(bc.cccd_vang)} vắng"
        for bc in bao_caos
    ]

    if chay_thu:
        return None, tom_tat, canh_bao, script, hang_can

    try:
        stdout = sqlrun.chay_script(may_chu, csdl, script)
        kq = _KetQuaChay(stdout=stdout, stderr="", returncode=0)
    except sqlrun.LoiSqlcmd as e:
        kq = _KetQuaChay(stdout="", stderr=str(e), returncode=1)
    return kq, tom_tat, canh_bao, script, hang_can
