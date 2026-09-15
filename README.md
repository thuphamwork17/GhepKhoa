# Hệ thống lập danh sách thi tốt nghiệp ghép khóa

Gồm hai phần rời nhau, nối với nhau bằng một file CSV/Excel:

```
  Học viên                    Trung tâm                       Văn bản chính thức
 ─────────────              ─────────────                    ────────────────────
  web đăng ký   ──────►  admin duyệt, tải về   ──────►   script đối chiếu hồ sơ gốc
  (Next.js)              dangky-....csv                  → DS ghép khóa ....xls
```

Web chỉ thu **nguyện vọng**. Mọi nội dung in ra văn bản (họ tên, ngày sinh, địa chỉ,
số GPLX, mã học viên, mã khóa gốc) đều lấy từ hồ sơ gốc — học viên tự gõ sai cũng không
ảnh hưởng tới giấy tờ.

---

## Những quyết định đã chốt

Ghi lại để lần sau khỏi phải điều tra lại.

**Nguồn dữ liệu học viên — ưu tiên database, Excel là đường lùi.**
`GPLX_CSDT` (SQL Server) chứa đủ mọi trường cần cho file ghép khóa. Đã kiểm chứng trên
khóa C1K82: 80/80 học viên khớp ở họ tên, ngày sinh, CCCD, địa chỉ, số GPLX và mã học
viên. Đọc DB nhanh hơn và không phụ thuộc mạng nội bộ — hôm khảo sát, share `\\thanh`
sập giữa chừng, đó là lý do không nên dựa hẳn vào nó.

| Nguồn | Phạm vi | Ghi chú |
|---|---|---|
| DB `GPLX_CSDT` | chỉ cơ sở **92004** (Trung tâm) | bản `.bak` là ảnh chụp tĩnh, cần làm tươi định kỳ |
| Excel `Bao cao 1 *.xls` | cả hai cơ sở | bắt buộc dùng cho **92001** (Trường) tới khi có DB riêng |

**Hạng GPLX lấy theo DB, không theo Excel.** Hai học viên C1K82 có Excel ghi `A` còn DB
ghi `Am`. Tra `DM_HangGPLX` thì hạng `A2` cũ có `MaHangMoi = 'Am'`, tức DB đang theo danh
mục mới còn Excel còn ghi kiểu cũ. File sinh ra sẽ ghi `Am` — khác file cũ, và là cố ý.

**Kết quả thi tốt nghiệp không có trong DB.** DB chỉ giữ kết quả *sát hạch*
(`NguoiLX_HoSo.KetQuaSH`: `DA`/`RO`/`VA`…). Còn cái tách "đạt / vắng thi" của kỳ thi tốt
nghiệp chỉ nằm ở sheet `bc2` trong Excel, do cán bộ tự đánh dấu. Không chặn được việc gì
vì người học tự đăng ký là đã tự khai còn nợ tốt nghiệp; cột này chỉ dùng để cảnh báo chéo.

**Ánh xạ mã khóa.** `KhoaHoc.TenKH` = `"C1 KHÓA 84/2026"` ↔ thư mục `Khoa C1K84 …` ↔
`MaKH = 92004K26C1008` ↔ file XML `BC1_92004_92_92004K26C1008.xml`. Khi đọc từ DB thì
dùng `TenKH`; khi đọc từ thư mục thì **hạng lấy ở thư mục cha, số khóa lấy ở tên thư mục**
— bên Trường hạng B1 đặt tên thư mục chỉ là `Khoa 100`, ghép lại mới ra `B1K100`. Cũng vì
vậy mà `BK100` và `B1K100` là hai khóa khác nhau, không phải gõ nhầm.

**Ranh giới ghi.** Chỉ được ghi vào `DrivingManagement` và thư mục làm việc trên Desktop.

| Nơi | Quyền |
|---|---|
| `DrivingManagement` (SQLEXPRESS) — đăng ký từ web | đọc + ghi |
| `GPLX_CSDT` — hồ sơ học viên gốc | **chỉ đọc** |
| `\\thanh\E\tay do`, `\\thanh\E\truong cao dang` | **chỉ đọc** |
| `Desktop\GhepKhoa\` | nơi duy nhất xuất file kết quả |

Hàng rào nằm ở [tools/ghepkhoa/antoan.py](tools/ghepkhoa/antoan.py), chặn theo đường dẫn
đã chuẩn hóa nên đi vòng bằng `..`, bằng hoa/thường, hay bằng ổ đĩa ánh xạ đều không lách
được. Mọi lối ghi file Excel đều phải qua đó.

---

## Phần 1 — Web đăng ký (`web/`)

Next.js 16 + SQLite. Học viên tự đăng ký, admin duyệt rồi tải danh sách về.

### Cài và chạy

```bat
cd D:\GhepKhoa\web
npm install
```

Tạo file `web\.env.local`:

```
ADMIN_MATKHAU=matkhaucuaban
ADMIN_BIMAT=mot-chuoi-ngau-nhien-that-dai-doi-lai-khi-trien-khai
```

> `ADMIN_BIMAT` dùng để ký cookie đăng nhập. Đổi chuỗi này thì mọi phiên đang mở bị đăng xuất.

Chạy thử:

```bat
npm run dev            REM http://localhost:3000
```

Chạy thật:

```bat
npm run build
npm run start
```

### Các trang

| Đường dẫn | Ai dùng | Việc |
|---|---|---|
| `/` | học viên | Chọn đợt, nhập họ tên / ngày sinh / CCCD / khóa cũ / SĐT |
| `/tra-cuu` | học viên | Nhập CCCD xem đăng ký của mình đã được duyệt chưa |
| `/dang-nhap` | admin | Đăng nhập bằng `ADMIN_MATKHAU` |
| `/admin` | admin | Xem, duyệt, trả lại, xóa đăng ký; tải CSV / Excel |
| `/admin/dot` | admin | Tạo đợt ghép khóa (mã khóa, ngày thi, hạn ĐK, số lượng tối đa) |

### Cho học viên vào được từ ngoài

Máy chạy `npm run start` nghe ở cổng 3000. Chọn một trong ba cách:

- **Trong mạng nội bộ**: mở cổng 3000 trên tường lửa, học viên vào `http://<IP-máy>:3000`.
- **Tạm thời qua Internet**: `npx cloudflared tunnel --url http://localhost:3000` — được một
  địa chỉ https dùng ngay, tắt lệnh là mất.
- **Lâu dài**: đưa thư mục `web/` lên một VPS, chạy sau nginx. Nhớ mang theo `data/ghepkhoa.db`.

### Dữ liệu

Toàn bộ nằm trong `web\data\ghepkhoa.db` (SQLite). Sao lưu = copy file đó.
`node scripts/tao-du-lieu-mau.mjs` tạo dữ liệu giả để thử — **xóa sạch bảng cũ**, đừng chạy
trên dữ liệu thật.

---

## Phần 2 — Script lập danh sách (`tools/`)

Python + Excel COM. Đọc `Bao cao 1 *.xls`, đổ dữ liệu vào bản sao của file mẫu.

### Cài

```bat
python -m pip install xlrd pywin32 openpyxl
```

Cần có Microsoft Excel trên máy (script điều khiển Excel để giữ nguyên font VNI, merge
cell, khung ký tên — thư viện Python thuần không làm được).

### Chuẩn bị thư mục

```
D:\GhepKhoa\
├── Bao cao 1 c1k52.xls          ← nguồn dữ liệu học viên
├── Bao cao 1 C1K53 2026.xls
├── Bao cao 1 C1K82 TT 2026.xls
└── Mau\                          ← file mẫu TRỐNG, chỉ để làm khuôn
    ├── DS ghép khóa TN mau BK-CDTD.xls
    └── DS ghép khóa TN mau C1-TTTD.xls
```

Script tự lấy mẫu mới nhất trong `Mau\`. Để mẫu lẫn ngoài thư mục gốc rất dễ bị vớ nhầm
một file đã điền của lần chạy trước.

### Lệnh

Đặt biến môi trường một lần cho mỗi cửa sổ lệnh:

```bat
set PYTHONPATH=D:\GhepKhoa\tools
```

**Lập danh sách từ đăng ký web** (cách chính):

```bat
python -m ghepkhoa tao --khoa BK100 --ngay 09/08/2026 ^
       --dangky "D:\GhepKhoa\web\data\dangky-bk100.csv"
```

**Lập danh sách từ cột Ghi chú của BC1** (cách cũ, không cần web):

```bat
python -m ghepkhoa tao --khoa BK100 --ngay 09/08/2026
```

Thêm `--thu` để chỉ xem trước, không ghi file.

**Sau khi thi — tách đạt / vắng thi:**

```bat
python -m ghepkhoa ketqua --file "DS ghép khóa TN với BK100 09-08-2026 (đã điền).xls" ^
       --dat dsdat.txt
```

`--dat` nhận `.txt` (mỗi dòng một CCCD), `.csv`, `.xls` hoặc `.xlsx` — tự dò cột chứa CCCD.
Kết quả: sheet `DATTN` với người đạt đánh số lại ở cột F, người vắng thi đẩy xuống dưới
khối ký tên.

**Giao diện bấm nút** (không thích gõ lệnh):

```bat
D:\GhepKhoa\tools\GhepKhoa.bat
```

**Dọn sheet virus khỏi một file bất kỳ:**

```bat
python -m ghepkhoa donvirus --file "duong-dan.xls"
```

### Hai cách chọn người

| | Nguồn danh sách | Khi nào dùng |
|---|---|---|
| Mặc định | Cột **Ghi chú** (cột K) trong sheet BC1 — admin gõ tay mã khóa đích vào từng dòng | Chưa mở web, hoặc số lượng ít |
| `--dangky` | File tải từ web, đối chiếu ngược lại Báo cáo 1 | Đã mở cổng đăng ký |

Cách đối chiếu khi dùng `--dangky`:

1. Khớp theo **CCCD** trước — đây là định danh thật.
2. Không thấy thì dò theo **tên + ngày sinh**, và in cảnh báo `KHỚP MỜ`.
3. Vẫn không thấy thì báo `KHÔNG TÌM THẤY` và **bỏ người đó ra**, không tự bịa dữ liệu.
4. Người trùng tên ở nhiều khóa: dùng mã khóa học viên tự khai để thu hẹp; còn mơ hồ thì
   báo lỗi và bỏ qua, chờ admin sửa.

Chỉ những đăng ký ở trạng thái **Đã duyệt** mới được lấy (thêm `--ca-chua-duyet` để lấy hết).

### Cảnh báo script tự phát hiện

- CCCD trùng giữa các file nguồn
- CCCD không đủ 12 số, thiếu ngày sinh / địa chỉ
- Người đã ĐẠT ở khóa cũ mà vẫn đăng ký thi lại
- Mã khóa gõ sai dấu (`CẸK143` lẫn với `CEK143`)
- Học viên khai khóa cũ lệch với hồ sơ
- Các mã khóa khác đang chờ ghép, để không bỏ sót đợt nào

---

## ⚠ Virus macro trong file mẫu

Hai file `DS ghép khóa ....xls` gốc chứa sheet ẩn **`XL4Poppy`** — virus macro Excel 4.0
(XF.Classic/Poppy, 1998). Payload đã bị Kaspersky vô hiệu nhưng sheet vẫn còn và **vẫn lây
sang mọi file mới tạo từ mẫu đó**.

Script tự xóa sheet này khỏi mọi file nó sinh ra. Với các file cũ, chạy:

```bat
python -m ghepkhoa donvirus --file "D:\GhepKhoa\DS ghép khóa TN VOI C1K82 18-07-2026.xls"
```

Script cũng luôn mở Excel với `AutomationSecurity = ForceDisable` nên macro không chạy được.

---

## Tự kiểm tra

```bat
python D:\GhepKhoa\tools\tu_kiem_tra.py
```

Đối chiếu logic của script với các file mẫu có sẵn: số học viên, số đạt/vắng, thứ tự sắp
xếp tên tiếng Việt, thứ tự nhóm khóa. Chạy sau mỗi lần sửa code.

Riêng thứ tự sắp xếp khớp 36/38 dòng của file mẫu C1K82; 2 dòng lệch là hai người cùng tên
LONG ở khóa C1K74, trong bản gốc được xếp theo ngày đăng ký hồ sơ chứ không theo tên.
