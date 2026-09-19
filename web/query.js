const sql = require('mssql');
const conf = {server: '192.168.1.20', user: 'sa', password: '123456', database: 'GPLX_CSDT', options: {enableArithAbort: true, encrypt: false, trustServerCertificate: true}};
sql.connect(conf).then(p => p.query(`SELECT TOP 5 n.HoVaTen, k.TenKH FROM NguoiLX n JOIN NguoiLX_HoSo h ON n.MaDK = h.MaDK JOIN KhoaHoc k ON k.MaKH = h.MaKhoaHoc WHERE n.HoVaTen LIKE N'%TÍNH%'`)).then(r => {console.log(r.recordset); process.exit(0)}).catch(console.error);
