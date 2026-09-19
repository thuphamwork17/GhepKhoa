
const sql = require('mssql/msnodesqlv8');

// Đích (Web DB)
const configWeb = {
  server: 'thupham.id.vn', 
  database: 'DrivingManagement',
  user: 'sa', 
  password: '123456',
  port: 14333, // Điền đúng port 14333 đã mở
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};


// Nguồn 1: Trung Tâm (92004)
const configTrungTam = {
  driver: 'SQL Server',
  server: '192.168.1.28',
  database: 'GPLX_CSDT',
  user: 'sa',
  password: '123456',
  options: { instanceName: 'SQLEXPRESS', enableArithAbort: true },
  requestTimeout: 30000,
};

// Nguồn 2: Trường (92001)
const configTruong = {
  driver: 'SQL Server',
  server: '192.168.1.20',
  database: 'GPLX_CSDT',
  user: 'sa',
  password: '123456',
  options: { enableArithAbort: true },
  requestTimeout: 30000,
};

const qLayDuLieu = `
  SELECT n.MaDK,
         n.HoVaTen, 
         RIGHT(n.NgaySinh,2) + '/' + SUBSTRING(n.NgaySinh,5,2) + '/' + LEFT(n.NgaySinh,4) AS NgaySinh,
         ISNULL(n.SoCMT, '') AS Cccd,
         ISNULL(n.NoiCT, '') AS DiaChi,
         ISNULL(h.HangGPLXDaCo, '') AS HangGplxDaCo,
         ISNULL(h.SoGPLXDaCo, '') AS SoGplxDaCo,
         ISNULL(n.MaDK, '') + '-' + ISNULL(k.HangGPLX, '') AS MaHocVien,
         k.MaKH,
         k.TenKH,
         k.HangGPLX,
         ISNULL(CONVERT(varchar(10), k.NgayBG, 120), '') AS NgayBeGiang
  FROM dbo.NguoiLX n
  JOIN dbo.NguoiLX_HoSo h ON h.MaDK = n.MaDK
  JOIN dbo.KhoaHoc k ON k.MaKH = h.MaKhoaHoc
  WHERE k.NgayBG >= DATEADD(month, -12, GETDATE())
     OR k.NgayBG IS NULL;
`;

async function fetchFrom(config, ten, maCoSo) {
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const rs = await pool.request().query(qLayDuLieu);
    await pool.close();
    console.log(`Đã lấy ${rs.recordset.length} hồ sơ từ máy chủ ${ten} (${maCoSo}).`);
    return rs.recordset.map(row => ({ ...row, MaCoSo: maCoSo }));
  } catch (err) {
    console.error(`Lỗi kết nối máy chủ ${ten}:`, err.message);
    return [];
  }
}

async function runSync() {
  console.log(`[${new Date().toISOString()}] Bắt đầu đồng bộ từ 2 máy chủ...`);
  
  const [dataTrungTam, dataTruong] = await Promise.all([
    fetchFrom(configTrungTam, "Trung Tâm", "92004"),
    fetchFrom(configTruong, "Trường", "92001")
  ]);

  const allData = [...dataTrungTam, ...dataTruong];
  if (allData.length === 0) {
    console.log("Không có dữ liệu mới để đồng bộ.");
    return;
  }

  let poolWeb;
  try {
    poolWeb = await sql.connect(configWeb);
    const transaction = new sql.Transaction(poolWeb);
    await transaction.begin();
    try {
      const reqDelete = new sql.Request(transaction);
      await reqDelete.query('TRUNCATE TABLE Sync_HocVien');
      
      const table = new sql.Table('Sync_HocVien');
      table.create = false;
      table.columns.add('MaDK', sql.VarChar(50), { nullable: false }); // Primary Key logic will be handled by DB
      table.columns.add('MaCoSo', sql.VarChar(10), { nullable: false });
      table.columns.add('HoVaTen', sql.NVarChar(255), { nullable: true });
      table.columns.add('NgaySinh', sql.VarChar(20), { nullable: true });
      table.columns.add('Cccd', sql.VarChar(50), { nullable: true });
      table.columns.add('DiaChi', sql.NVarChar(500), { nullable: true });
      table.columns.add('HangGplxDaCo', sql.VarChar(20), { nullable: true });
      table.columns.add('SoGplxDaCo', sql.VarChar(50), { nullable: true });
      table.columns.add('MaHocVien', sql.VarChar(100), { nullable: true });
      table.columns.add('MaKH', sql.VarChar(50), { nullable: true });
      table.columns.add('TenKH', sql.NVarChar(255), { nullable: true });
      table.columns.add('HangGPLX', sql.VarChar(20), { nullable: true });
      table.columns.add('NgayBeGiang', sql.VarChar(20), { nullable: true });
      table.columns.add('LastSync', sql.DateTime, { nullable: true });
      
      const now = new Date();
      for (const row of allData) {
        table.rows.add(
          row.MaDK, row.MaCoSo, row.HoVaTen, row.NgaySinh, row.Cccd, row.DiaChi, 
          row.HangGplxDaCo, row.SoGplxDaCo, row.MaHocVien, row.MaKH, 
          row.TenKH, row.HangGPLX, row.NgayBeGiang, now
        );
      }
      
      const reqInsert = new sql.Request(transaction);
      await reqInsert.bulk(table);
      await transaction.commit();
      console.log(`Đã ghi thành công tổng cộng ${allData.length} hồ sơ vào DB Web.`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Lỗi cập nhật CSDL Web:", err);
  } finally {
    if (poolWeb) await poolWeb.close();
  }
}

if (require.main === module) {
  runSync().then(() => {
    console.log("Xong.");
    process.exit(0);
  });
}

module.exports = { runSync };
