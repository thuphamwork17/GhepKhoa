const sql = require('mssql');
const config = {
  server: '192.168.1.20',
  database: 'GPLX_CSDT',
  user: 'sa',
  password: '123456',
  options: { enableArithAbort: true, encrypt: false, trustServerCertificate: true },
  requestTimeout: 30000,
};

async function test() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT n.HoVaTen, k.MaKH, k.TenKH, k.HangGPLX
      FROM dbo.NguoiLX n
      JOIN dbo.NguoiLX_HoSo h ON n.MaDK = h.MaDK
      JOIN dbo.KhoaHoc k ON k.MaKH = h.MaKhoaHoc
      WHERE n.HoVaTen LIKE N'%NHỰT THẮNG%'
    `);
    console.log(result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
