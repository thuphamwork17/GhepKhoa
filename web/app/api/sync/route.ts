import { NextResponse } from 'next/server';
import { sql, pool } from '@/lib/sql';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    // Basic security token to prevent abuse
    if (authHeader !== 'Bearer CHITHANH_SYNC_TOKEN_2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = await request.json();
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    console.log(`Nhận được ${data.length} hồ sơ từ API Sync.`);

    const poolWeb = await pool();
    const transaction = new sql.Transaction(poolWeb);
    await transaction.begin();

    try {
      // 1. Truncate bảng cũ
      const reqTruncate = new sql.Request(transaction);
      await reqTruncate.query('TRUNCATE TABLE dbo.Sync_HocVien');

      // 2. Chuẩn bị bảng Bulk
      const table = new sql.Table('Sync_HocVien');
      table.create = false;
      table.columns.add('MaDK', sql.VarChar(50), { nullable: true });
      table.columns.add('MaCoSo', sql.VarChar(10), { nullable: true });
      table.columns.add('HoVaTen', sql.NVarChar(100), { nullable: true });
      table.columns.add('NgaySinh', sql.VarChar(20), { nullable: true });
      table.columns.add('Cccd', sql.VarChar(20), { nullable: true });
      table.columns.add('DiaChi', sql.NVarChar(255), { nullable: true });
      table.columns.add('HangGplxDaCo', sql.VarChar(20), { nullable: true });
      table.columns.add('SoGplxDaCo', sql.VarChar(50), { nullable: true });
      table.columns.add('MaHocVien', sql.VarChar(50), { nullable: true });
      table.columns.add('MaKH', sql.VarChar(50), { nullable: true });
      table.columns.add('TenKH', sql.NVarChar(200), { nullable: true });
      table.columns.add('HangGPLX', sql.VarChar(10), { nullable: true });
      table.columns.add('NgayBeGiang', sql.VarChar(20), { nullable: true });
      table.columns.add('NgayDongBo', sql.DateTime, { nullable: true });

      const now = new Date();
      for (const row of data) {
        table.rows.add(
          row.MaDK, row.MaCoSo, row.HoVaTen, row.NgaySinh, row.Cccd, row.DiaChi,
          row.HangGplxDaCo, row.SoGplxDaCo, row.MaHocVien, row.MaKH,
          row.TenKH, row.HangGPLX, row.NgayBeGiang, now
        );
      }

      // 3. Thực thi Bulk Insert
      const reqInsert = new sql.Request(transaction);
      await reqInsert.bulk(table);
      await transaction.commit();

      console.log(`Đã ghi thành công ${data.length} hồ sơ qua API.`);
      return NextResponse.json({ success: true, count: data.length });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error("Lỗi API Sync:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
