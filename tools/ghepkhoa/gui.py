# -*- coding: utf-8 -*-
"""Giao diện bấm nút (Tkinter, có sẵn trong Python — không cần cài thêm)."""

import queue
import threading
import traceback
from datetime import date, datetime
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, W, X, Y, StringVar, Tk, filedialog, messagebox, ttk
import tkinter as tk

from . import lenh

MAC_DINH_NGUON = r"D:\GhepKhoa"


def _mau_moi_nhat(thu_muc):
    """Ưu tiên thư mục con "Mau" để không vớ nhầm file DS đã điền lần trước."""
    for goc in (Path(thu_muc) / "Mau", Path(thu_muc)):
        ds = [
            p
            for p in goc.glob("DS ghép khóa*.xls")
            if not p.name.startswith("~$") and "(đã điền" not in p.name
        ]
        if ds:
            return str(max(ds, key=lambda p: p.stat().st_mtime))
    return ""


class App:
    def __init__(self, root):
        self.root = root
        root.title("Lập danh sách thi tốt nghiệp ghép khóa")
        root.geometry("980x620")
        self.hang_doi = queue.Queue()

        khung = ttk.Frame(root, padding=12)
        khung.pack(fill=BOTH, expand=True)

        self.nguon = StringVar(value=MAC_DINH_NGUON)
        self.mau = StringVar(value=_mau_moi_nhat(MAC_DINH_NGUON))
        self.khoa = StringVar()
        self.ngay = StringVar(value=date.today().strftime("%d/%m/%Y"))

        self._dong(khung, 0, "Thư mục chứa 'Bao cao 1 *.xls'", self.nguon, self._chon_thu_muc)
        self._dong(khung, 1, "File mẫu (.xls)", self.mau, self._chon_mau)

        f = ttk.Frame(khung)
        f.grid(row=2, column=0, columnspan=3, sticky="we", pady=(8, 4))
        ttk.Label(f, text="Mã khóa đích", width=28).pack(side=LEFT)
        ttk.Entry(f, textvariable=self.khoa, width=24).pack(side=LEFT)
        ttk.Label(f, text="   Ngày thi (dd/mm/yyyy)").pack(side=LEFT)
        ttk.Entry(f, textvariable=self.ngay, width=14).pack(side=LEFT)
        ttk.Label(f, text="   (nhiều mã: ngăn bởi dấu phẩy)", foreground="#666").pack(side=LEFT)

        g = ttk.Frame(khung)
        g.grid(row=3, column=0, columnspan=3, sticky="we", pady=8)
        self.nut_xem = ttk.Button(g, text="Xem trước", command=lambda: self._chay(True))
        self.nut_xem.pack(side=LEFT)
        self.nut_tao = ttk.Button(g, text="Tạo file", command=lambda: self._chay(False))
        self.nut_tao.pack(side=LEFT, padx=6)
        ttk.Button(g, text="Liệt kê các mã khóa đang chờ", command=self._liet_ke).pack(side=LEFT, padx=6)
        ttk.Button(g, text="Xóa log", command=lambda: self.log.delete("1.0", END)).pack(side=RIGHT)

        khung.columnconfigure(1, weight=1)

        self.log = tk.Text(khung, wrap="none", font=("Consolas", 10))
        self.log.grid(row=4, column=0, columnspan=3, sticky="nsew")
        khung.rowconfigure(4, weight=1)
        sb = ttk.Scrollbar(khung, command=self.log.yview)
        sb.grid(row=4, column=3, sticky="ns")
        self.log.config(yscrollcommand=sb.set)
        self.log.tag_config("loi", foreground="#b00020")
        self.log.tag_config("canhbao", foreground="#a25e00")
        self.log.tag_config("ok", foreground="#0a6b2e")

        self.root.after(120, self._bom)

    # ---------------------------------------------------------------- tiện ích
    def _dong(self, cha, r, nhan, bien, lenh_chon):
        ttk.Label(cha, text=nhan, width=28).grid(row=r, column=0, sticky=W, pady=3)
        ttk.Entry(cha, textvariable=bien).grid(row=r, column=1, sticky="we", pady=3)
        ttk.Button(cha, text="Chọn…", command=lenh_chon).grid(row=r, column=2, padx=(6, 0))

    def _chon_thu_muc(self):
        d = filedialog.askdirectory(initialdir=self.nguon.get() or ".")
        if d:
            self.nguon.set(d)
            if not self.mau.get():
                self.mau.set(_mau_moi_nhat(d))

    def _chon_mau(self):
        f = filedialog.askopenfilename(
            initialdir=self.nguon.get() or ".", filetypes=[("Excel 97-2003", "*.xls"), ("Tất cả", "*.*")]
        )
        if f:
            self.mau.set(f)

    def _in(self, s, tag=None):
        self.hang_doi.put((s, tag))

    def _bom(self):
        try:
            while True:
                s, tag = self.hang_doi.get_nowait()
                self.log.insert(END, s + "\n", tag or ())
                self.log.see(END)
        except queue.Empty:
            pass
        self.root.after(120, self._bom)

    def _khoa_nut(self, bat):
        for n in (self.nut_xem, self.nut_tao):
            n.state(["!disabled"] if bat else ["disabled"])

    # ---------------------------------------------------------------- hành động
    def _liet_ke(self):
        def viec():
            from . import baocao
            bcs, loi = baocao.doc_thu_muc(self.nguon.get())
            from collections import Counter
            dem = Counter()
            for bc in bcs:
                self._in(f"{bc.duong_dan.name}  →  {bc.ma_khoa}: {len(bc.hoc_vien)} HV, "
                         f"{len(bc.cccd_dat)} đạt / {len(bc.cccd_vang)} vắng")
                for hv in bc.hoc_vien:
                    if hv.ghi_chu.strip():
                        dem[hv.ghi_chu.strip().upper()] += 1
            self._in("")
            self._in("Các mã khóa đang chờ ghép:")
            for k, v in sorted(dem.items()):
                self._in(f"    {k:<14} {v:>3} người")
            for e in loi:
                self._in("! " + e, "loi")
            self._in("")
        threading.Thread(target=viec, daemon=True).start()

    def _chay(self, chi_xem):
        try:
            ngay = datetime.strptime(self.ngay.get().strip(), "%d/%m/%Y").date()
        except ValueError:
            messagebox.showerror("Sai ngày", "Ngày thi phải có dạng dd/mm/yyyy")
            return
        if not self.khoa.get().strip():
            messagebox.showerror("Thiếu mã khóa", "Nhập mã khóa đích, ví dụ BK100")
            return
        if not chi_xem and not Path(self.mau.get()).is_file():
            messagebox.showerror("Thiếu file mẫu", "Chọn file .xls dùng làm mẫu")
            return

        self._khoa_nut(False)

        def viec():
            try:
                file_ra, ds, tt = lenh.tao_ds_ghep_khoa(
                    self.nguon.get(), self.khoa.get().split(","), ngay,
                    self.mau.get(), None, chay_thu=chi_xem,
                )
                self._in("=" * 92)
                for d in tt["nguon"]:
                    self._in("  " + d)
                self._in("")
                self._in(f"  Khóa đích: {' + '.join(tt['khoa_dich'])}    "
                         f"Số thí sinh: {tt['so_thi_sinh']}")
                for i, hv in enumerate(ds, 1):
                    self._in(f"   {i:>3}. {hv.ho_ten:<34}{hv.ngay_sinh:<12}{hv.cccd:<14}{hv.ma_khoa_goc}")
                if tt["ma_khoa_khac_dang_cho"]:
                    self._in("")
                    self._in("  Mã khóa khác đang chờ: " + ", ".join(
                        f"{k}({v})" for k, v in tt["ma_khoa_khac_dang_cho"].items()))
                for c in tt["canh_bao"]:
                    self._in("  ! " + c, "canhbao")
                if tt.get("xoa_sheet"):
                    self._in(f"  ⚠ Đã loại sheet virus khỏi bản mới: {', '.join(tt['xoa_sheet'])}", "canhbao")
                if file_ra:
                    self._in("")
                    self._in(f"  ✔ Đã ghi: {file_ra}", "ok")
                elif chi_xem:
                    self._in("\n  (chỉ xem trước — chưa ghi file)")
                self._in("")
            except Exception:
                self._in(traceback.format_exc(), "loi")
            finally:
                self.root.after(0, lambda: self._khoa_nut(True))

        threading.Thread(target=viec, daemon=True).start()


def chay():
    root = Tk()
    App(root)
    root.mainloop()
    return 0
