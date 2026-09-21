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
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%DVHC%' OR TABLE_NAME LIKE '%HanhChinh%' OR TABLE_NAME LIKE '%Tinh%' OR TABLE_NAME LIKE '%Xa%' OR TABLE_NAME LIKE '%Huyen%'
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
