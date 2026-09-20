const sql = require('mssql');
const configTruong = {
  server: '192.168.1.20',
  database: 'GPLX_CSDT',
  user: 'sa',
  password: '123456',
  options: { enableArithAbort: true, encrypt: false, trustServerCertificate: true },
  requestTimeout: 30000,
};

const configTrungTam = {
  server: '192.168.1.28',
  database: 'GPLX_CSDT',
  user: 'sa',
  password: '123456',
  options: { instanceName: 'SQLEXPRESS', enableArithAbort: true, encrypt: false, trustServerCertificate: true },
  requestTimeout: 30000,
};

async function test(cfg, name) {
  try {
    const pool = await sql.connect(cfg);
    const result = await pool.request().query(`
      SELECT n.HoVaTen, k.MaKH, k.TenKH, k.HangGPLX
      FROM dbo.NguoiLX n
      JOIN dbo.NguoiLX_HoSo h ON n.MaDK = h.MaDK
      JOIN dbo.KhoaHoc k ON k.MaKH = h.MaKhoaHoc
      WHERE n.HoVaTen LIKE N'%THÚY AN%'
    `);
    console.log(name, result.recordset);
    await pool.close();
  } catch (err) {
    console.error(name, err);
  }
}
async function run() {
  await test(configTruong, "TRUONG");
  await test(configTrungTam, "TRUNG_TAM");
  process.exit(0);
}
run();
