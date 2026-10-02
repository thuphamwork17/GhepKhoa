const sql = require('mssql');
const configTrungTam = {
  server: '192.168.1.28',
  database: 'GPLX_CSDT',
  user: 'sa',
  password: '123456',
  options: { instanceName: 'SQLEXPRESS', enableArithAbort: true, encrypt: false, trustServerCertificate: true },
  requestTimeout: 30000
};

async function test(cfg) {
  try {
    const pool = await sql.connect(cfg);
    const result = await pool.request().query(`
      SELECT TOP 5
         n.HoVaTen,
         n.NoiTT,
         n.NoiTT_MaDVHC,
         dv.TenDayDu,
         LTRIM(RTRIM(ISNULL(n.NoiTT, N'') + N', ' + ISNULL(dv.TenDayDu, N''))) AS DiaChi
      FROM dbo.NguoiLX n
      OUTER APPLY (SELECT TOP 1 TenDayDu FROM dbo.DM_DVHC WHERE MaDvhc = n.NoiTT_MaDVHC ORDER BY TrangThai DESC) dv
    `);
    console.log(result.recordset);
    await pool.close();
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}

test(configTrungTam);
