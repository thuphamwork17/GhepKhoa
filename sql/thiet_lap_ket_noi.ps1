<#
    Mở đường cho ứng dụng Node kết nối vào SQL Server.

    PHẢI CHẠY BẰNG QUYỀN ADMIN. Script sẽ:
      1. Bật giao thức TCP/IP cho instance (mặc định đang tắt trên SQL Express)
      2. Đặt cổng tĩnh (mặc định 1433) thay cho cổng động
      3. Chuyển sang chế độ xác thực hỗn hợp (Windows + SQL login)
      4. KHỞI ĐỘNG LẠI dịch vụ SQL Server  <-- mọi kết nối đang mở sẽ bị ngắt
      5. Tạo login SQL cho ứng dụng, chỉ cấp quyền đọc/ghi trên 1 database

    Lý do phải làm: thư viện `mssql` của Node dùng driver tedious viết thuần
    JavaScript, chỉ nói chuyện qua TCP và không dùng được Windows auth. Driver
    ODBC gốc (msnodesqlv8) thì chưa chạy được trên Node 24.

    Cách chạy:
        powershell -ExecutionPolicy Bypass -File D:\GhepKhoa\sql\thiet_lap_ket_noi.ps1 -MatKhau 'MatKhauManh#2026'

    Xem trước mà không đổi gì:
        ... -ChiXem
#>
param(
  [string]$Instance = 'SQLEXPRESS',
  [string]$Server   = 'ThuPham\SQLEXPRESS',
  [string]$Database = 'DrivingManagement',
  [string]$Login    = 'ghepkhoa_app',
  [string]$MatKhau,
  [int]   $Cong     = 1433,
  [switch]$ChiXem
)

$ErrorActionPreference = 'Stop'

function Buoc($s) { Write-Host "`n== $s" -ForegroundColor Cyan }

# --- kiem tra quyen admin ---------------------------------------------------
$laAdmin = ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laAdmin -and -not $ChiXem) {
  Write-Host "Script nay can quyen Administrator. Mo PowerShell bang 'Run as administrator' roi chay lai." -ForegroundColor Red
  exit 1
}

if (-not $ChiXem -and [string]::IsNullOrWhiteSpace($MatKhau)) {
  Write-Host "Thieu -MatKhau. Dat mot mat khau manh cho login '$Login'." -ForegroundColor Red
  exit 1
}

# --- tim khoa registry cua instance -----------------------------------------
$goc = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server'
$key = Get-ChildItem $goc | Where-Object { $_.PSChildName -like "MSSQL*.$Instance" } | Select-Object -First 1
if (-not $key) { Write-Host "Khong tim thay instance $Instance" -ForegroundColor Red; exit 1 }

$tcp        = Join-Path $key.PSPath 'MSSQLServer\SuperSocketNetLib\Tcp'
$ipAll      = Join-Path $tcp 'IPAll'
$mssqlSrv   = Join-Path $key.PSPath 'MSSQLServer'
$dichVu     = "MSSQL`$$Instance"

Buoc "Hien trang"
Write-Host ("  TCP Enabled     : " + (Get-ItemProperty $tcp).Enabled)
Write-Host ("  TcpPort         : '" + (Get-ItemProperty $ipAll).TcpPort + "'")
Write-Host ("  TcpDynamicPorts : '" + (Get-ItemProperty $ipAll).TcpDynamicPorts + "'")
Write-Host ("  LoginMode       : " + (Get-ItemProperty $mssqlSrv).LoginMode + "  (1=chi Windows, 2=hon hop)")
Write-Host ("  Dich vu         : " + (Get-Service $dichVu).Status)

if ($ChiXem) { Write-Host "`n(-ChiXem: khong doi gi ca)" -ForegroundColor Yellow; exit 0 }

Buoc "Bat TCP/IP va dat cong tinh $Cong"
Set-ItemProperty $tcp   -Name Enabled         -Value 1
Set-ItemProperty $ipAll -Name TcpPort         -Value "$Cong"
Set-ItemProperty $ipAll -Name TcpDynamicPorts -Value ''
# tung dia chi IP con lai cung phai dong bo, khong thi SQL van nghe cong dong
Get-ChildItem $tcp | Where-Object { $_.PSChildName -like 'IP*' -and $_.PSChildName -ne 'IPAll' } | ForEach-Object {
  Set-ItemProperty $_.PSPath -Name TcpDynamicPorts -Value '' -ErrorAction SilentlyContinue
  Set-ItemProperty $_.PSPath -Name TcpPort         -Value "$Cong" -ErrorAction SilentlyContinue
}
Write-Host "  xong"

Buoc "Chuyen sang xac thuc hon hop"
Set-ItemProperty $mssqlSrv -Name LoginMode -Value 2
Write-Host "  xong"

Buoc "Khoi dong lai dich vu $dichVu"
Restart-Service $dichVu -Force
(Get-Service $dichVu).WaitForStatus('Running', '00:01:00')
Write-Host ("  " + (Get-Service $dichVu).Status)

Buoc "Tao login '$Login' va cap quyen tren [$Database]"
$sql = @"
SET NOCOUNT ON;
IF SUSER_ID(N'$Login') IS NULL
    CREATE LOGIN [$Login] WITH PASSWORD = N'$($MatKhau -replace "'", "''")',
        CHECK_POLICY = ON, DEFAULT_DATABASE = [$Database];
ELSE
    ALTER LOGIN [$Login] WITH PASSWORD = N'$($MatKhau -replace "'", "''")';
ALTER LOGIN [$Login] ENABLE;
GO
USE [$Database];
IF DATABASE_PRINCIPAL_ID(N'$Login') IS NULL
    CREATE USER [$Login] FOR LOGIN [$Login];
ALTER ROLE db_datareader ADD MEMBER [$Login];
ALTER ROLE db_datawriter ADD MEMBER [$Login];
GRANT EXECUTE ON SCHEMA::dbo TO [$Login];
-- co tinh KHONG cap ddl_admin: ung dung khong duoc sua lucoc do,
-- viec do de cho script trong thu muc sql\ chay bang Windows auth.
GO
SELECT N'Login san sang: ' + SUSER_NAME(SUSER_ID(N'$Login'));
"@
$tmp = Join-Path $env:TEMP 'gk_login.sql'
$sql | Out-File -FilePath $tmp -Encoding utf8
& sqlcmd -S $Server -E -C -b -I -f 65001 -i $tmp
$ok = $LASTEXITCODE
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
if ($ok -ne 0) { Write-Host "Tao login that bai" -ForegroundColor Red; exit $ok }

Buoc "Thu ket noi bang chinh login vua tao"
& sqlcmd -S "localhost,$Cong" -U $Login -P $MatKhau -d $Database -C -b -I -Q "SELECT 'Ket noi TCP OK, user = ' + SUSER_NAME();"
if ($LASTEXITCODE -ne 0) { Write-Host "Ket noi TCP that bai" -ForegroundColor Red; exit 1 }

Buoc "Ghi web\.env.local"
$env_file = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'web\.env.local'
$cu = @{}
if (Test-Path $env_file) {
  Get-Content $env_file | ForEach-Object {
    $i = $_.IndexOf('='); if ($i -gt 0) { $cu[$_.Substring(0, $i).Trim()] = $_.Substring($i + 1) }
  }
}
# ADMIN_BIMAT dung de ky cookie phien — doi no la moi nguoi bi dang xuat,
# nen giu lai neu da co, chi sinh moi khi chua co.
if (-not $cu['ADMIN_BIMAT']) {
  $b = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  $cu['ADMIN_BIMAT'] = [Convert]::ToBase64String($b)
}
$cu['SQL_MAY_CHU']    = 'localhost'
$cu['SQL_CONG']       = "$Cong"
$cu['SQL_CSDL']       = $Database
$cu['SQL_NGUOI_DUNG'] = $Login
$cu['SQL_MAT_KHAU']   = $MatKhau
$cu.Remove('ADMIN_MATKHAU')   # khong con dung mat khau chung, da co bang NguoiDung

# Boc nhay kep: trinh doc .env cua Next coi '#' la bat dau chu thich, mat khau
# co ky tu '#' se bi cat cut va sinh loi "Login failed". Nhay kep cung giup giu
# nguyen khoang trang va dau '=' trong gia tri.
$noiDung = ($cu.GetEnumerator() | Sort-Object Name | ForEach-Object {
  $v = [string]$_.Value -replace '\\', '\\\\' -replace '"', '\"'
  "$($_.Key)=`"$v`""
}) -join "`n"
# UTF8 khong BOM: Next.js doc .env bang parser rieng, dinh BOM la hong dong dau
[IO.File]::WriteAllText($env_file, $noiDung + "`n", (New-Object Text.UTF8Encoding $false))
Write-Host "  da ghi $env_file"

Write-Host "`nXong. Buoc tiep theo:" -ForegroundColor Green
Write-Host ""
Write-Host "  cd D:\GhepKhoa\web"
Write-Host "  node scripts/tao-nguoi-dung.mjs admin `"Ho ten cua ban`" QUAN_TRI"
Write-Host "  npm run dev"
Write-Host ""
