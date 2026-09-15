# -*- coding: utf-8 -*-
r"""Chạy sqlcmd và luôn nhận lại đúng UTF-8 — kể cả khi tiến trình Python này
bị khởi chạy mà KHÔNG có console thật (web Node.js dùng child_process.execFile
với windowsHide để gọi Python thì rơi đúng vào trường hợp này).

Đã kiểm chứng bằng thực nghiệm: sqlcmd.exe tự dò mã trang xuất ra dựa vào
GetConsoleOutputCP() của console đang gắn với nó. Không có console gắn kèm
thì nó rơi về một mã trang không biểu diễn được tiếng Việt, biến hết dấu
thành '?' — dù đã truyền `-f 65001`. Ví dụ thật: "VÕ THỊ TUYẾT TRINH" đọc qua
stdout (pipe) từ tiến trình do Node sinh ra thành "V? TH? TUY?T TRINH", khiến
việc so khớp tên trong napmot() trả về sai kết quả "không tìm thấy".

Cách chắc chắn duy nhất: bảo sqlcmd ghi kết quả ra FILE bằng `-o`, rồi tự đọc
file đó bằng UTF-8 — bỏ hẳn việc bắt stdout qua pipe.
"""

import os
import subprocess
import tempfile
from pathlib import Path


class LoiSqlcmd(RuntimeError):
    """sqlcmd trả về mã lỗi khác 0. Nội dung là thông báo lỗi (tiếng Việt/Anh
    trộn lẫn tùy câu lệnh), đọc được trực tiếp — không phải mã lỗi có cấu trúc."""


def _chay(
    may_chu: str, csdl: str, doi_so_them: list,
    nguoi_dung: str | None = None, mat_khau: str | None = None,
    thoi_gian_cho: int | None = None,
) -> str:
    # mkstemp() TRẢ VỀ MỘT FILE ĐANG MỞ (fd, path) — trên Windows, giữ fd đó mở
    # sẽ khóa độc quyền cả file, khiến sqlcmd không ghi được vào (-o path) dù
    # đường dẫn hợp lệ. Đóng ngay fd, chỉ giữ lại cái tên; sqlcmd tự tạo/ghi.
    fd, ten = tempfile.mkstemp(suffix=".sqlcmd.txt")
    os.close(fd)
    tam_ra = Path(ten)
    # Đăng nhập Windows (-E) cho các máy chủ nội bộ đã sẵn tài khoản Windows;
    # đăng nhập SQL (-U/-P) cho máy chủ khác domain — vd CHITHANH\SQLEXPRESS
    # của bên Trường, chỉ cấp tài khoản SQL (sa), không dùng chung domain.
    xac_thuc = ["-U", nguoi_dung, "-P", mat_khau] if nguoi_dung else ["-E"]
    # -l: số giây chờ đăng nhập tối đa. Mặc định của sqlcmd khá dài (~8s) —
    # với máy chủ chỉ thỉnh thoảng vào được mạng (như CHITHANH của Trường),
    # không set thì mỗi lần không vào được mạng là chờ hết 8s mới rơi xuống
    # nguồn dự phòng, cảm giác "đối chiếu lâu". Đặt ngắn cho các nguồn dạng đó.
    doi_gio = ["-l", str(thoi_gian_cho)] if thoi_gian_cho else []
    try:
        r = subprocess.run(
            ["sqlcmd", "-S", may_chu, "-d", csdl, *xac_thuc, *doi_gio, "-C", "-I", "-b", "-f", "65001",
             "-o", str(tam_ra), *doi_so_them],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        noi_dung = tam_ra.read_text(encoding="utf-8-sig", errors="replace") if tam_ra.exists() else ""
        if r.returncode:
            raise LoiSqlcmd((noi_dung or r.stdout or "").strip() + " " + (r.stderr or "").strip())
        return noi_dung
    finally:
        tam_ra.unlink(missing_ok=True)


def truy_van(
    may_chu: str, csdl: str, cau_lenh: str, phan_cach: str = "\t",
    nguoi_dung: str | None = None, mat_khau: str | None = None,
    thoi_gian_cho: int | None = None,
) -> list:
    """Chạy một câu SELECT, trả về list các dòng đã tách cột (bỏ header nhờ -h -1)."""
    noi_dung = _chay(
        may_chu, csdl, ["-W", "-s", phan_cach, "-h", "-1", "-Q", cau_lenh],
        nguoi_dung, mat_khau, thoi_gian_cho,
    )
    return [d.split(phan_cach) for d in noi_dung.splitlines() if d.strip()]


def chay_script(may_chu: str, csdl: str, script: str) -> str:
    """Chạy một script .sql nhiều lệnh (MERGE/UPDATE/BEGIN TRAN…). Trả về toàn
    bộ nội dung sqlcmd in ra (PRINT, bảng kết quả…) dưới dạng text UTF-8."""
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as f:
        f.write(script)
        tam_sql = f.name
    try:
        return _chay(may_chu, csdl, ["-i", tam_sql])
    finally:
        Path(tam_sql).unlink(missing_ok=True)
