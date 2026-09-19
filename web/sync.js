
const sql = require('mssql/msnodesqlv8');

// Đích (Web DB)
const configWeb = {
  server: 'sql.thupham.id.vn', 
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
`;

async function runSync() {
  const allData = [];

  try {
    console.log(`[${new Date().toISOString()}] Bắt đầu đồng bộ từ 2 máy chủ...`);
    
    // Lấy dữ liệu Trường
    try {
      const poolTruong = await new sql.ConnectionPool(configTruong).connect();
      const resultTruong = await poolTruong.request().query(qLayDuLieu);
      resultTruong.recordset.forEach(r => { r.MaCoSo = '92001'; allData.push(r); });
      console.log(`Đã lấy ${resultTruong.recordset.length} hồ sơ từ máy chủ Trường (92001).`);
      await poolTruong.close();
    } catch (e) {
      console.error(`Lỗi kết nối máy chủ Trường: ${e.message}`);
    }

    // Lấy dữ liệu Trung Tâm
    try {
      const poolTrungTam = await new sql.ConnectionPool(configTrungTam).connect();
      const resultTrungTam = await poolTrungTam.request().query(qLayDuLieu);
      resultTrungTam.recordset.forEach(r => { r.MaCoSo = '92004'; allData.push(r); });
      console.log(`Đã lấy ${resultTrungTam.recordset.length} hồ sơ từ máy chủ Trung Tâm (92004).`);
      await poolTrungTam.close();
    } catch (e) {
      console.error(`Lỗi kết nối máy chủ Trung Tâm: ${e.message}`);
    }

    if (allData.length === 0) {
      console.log("Không có dữ liệu mới để đồng bộ.");
      return;
    }

    console.log(`Đang gửi ${allData.length} hồ sơ qua Web API (thupham.id.vn)...`);
    
    const response = await fetch('https://thupham.id.vn/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer CHITHANH_SYNC_TOKEN_2026'
      },
      body: JSON.stringify({ data: allData })
    });

    if (response.ok) {
      const resData = await response.json();
      console.log(`Đã ghi thành công tổng cộng ${resData.count} hồ sơ vào DB Web qua API!`);
    } else {
      console.error("Lỗi cập nhật CSDL qua API. Status:", response.status, await response.text());
    }
  } catch (err) {
    console.error("Lỗi quá trình đồng bộ:", err);
  }
}

if (require.main === module) {
  runSync().then(() => {
    console.log("Xong.");
    process.exit(0);
  });
}

module.exports = { runSync };
