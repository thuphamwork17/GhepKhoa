<#
    Áp toàn bộ script SQL vào database, theo đúng thứ tự tên file.
    Chạy lại bao nhiêu lần cũng được.

        powershell -ExecutionPolicy Bypass -File D:\GhepKhoa\sql\capnhat.ps1

    Tham số:
        -Server    tên instance, mặc định ThuPham\SQLEXPRESS
        -Database  tên database, mặc định DrivingManagement
        -Chi       chỉ chạy các file khớp mẫu, ví dụ -Chi '00*'
#>
param(
  [string]$Server   = 'ThuPham\SQLEXPRESS',
  [string]$Database = 'DrivingManagement',
  [string]$Chi      = '*.sql'
)

$ErrorActionPreference = 'Stop'
$thuMuc = Split-Path -Parent $MyInvocation.MyCommand.Path

$files = Get-ChildItem -Path $thuMuc -Filter $Chi |
         Where-Object { $_.Name -match '^\d{3}_' } |
         Sort-Object Name

if (-not $files) { Write-Host "Khong tim thay file .sql nao trong $thuMuc"; exit 1 }

Write-Host "Server   : $Server"
Write-Host "Database : $Database"
Write-Host ("-" * 60)

foreach ($f in $files) {
  Write-Host ("-> " + $f.Name)
  # -f 65001: file luu UTF-8, khong co tham so nay thi tieng Viet thanh rac
  # -b      : gap loi thi dung han, tra ve exit code khac 0
  # -I      : bat QUOTED_IDENTIFIER. Bang Khoa co index tren cot tinh san
  #           (MaKhoa) nen INSERT se bi tu choi neu thieu co nay.
  & sqlcmd -S $Server -d $Database -E -C -b -I -f 65001 -i $f.FullName
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host ("THAT BAI tai " + $f.Name) -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host ("-" * 60)
Write-Host "Xong." -ForegroundColor Green
