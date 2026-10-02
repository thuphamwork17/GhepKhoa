import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const tongHopFile = formData.get('tongHop') as File | null;
    const chiTietFile = formData.get('chiTiet') as File | null;

    if (!tongHopFile || !chiTietFile) {
      return NextResponse.json({ error: 'Vui lòng upload đủ 2 file' }, { status: 400 });
    }

    const tongHopBuffer = Buffer.from(await tongHopFile.arrayBuffer());
    const chiTietBuffer = Buffer.from(await chiTietFile.arrayBuffer());

    // --- Xử lý Bảng kê tổng hợp ---
    const wbTongHop = new ExcelJS.Workbook();
    await wbTongHop.xlsx.load(tongHopBuffer as any);
    const wsTongHop = wbTongHop.worksheets[0];

    const outWbTongHop = new ExcelJS.Workbook();
    const outWsThTong = outWbTongHop.addWorksheet('Tổng');
    const outWsThChuyenKhoan = outWbTongHop.addWorksheet('Chuyển Khoản');
    const outWsThTienMat = outWbTongHop.addWorksheet('Tiền Mặt');

    // Các cột cần lấy cho Tổng hợp: Số hóa đơn(5), Mã khách hàng(6), Tên đơn vị mua hàng(8), Họ và tên người mua(9), Tổng tiền thanh toán(14), Người tạo(18), Hình thức thanh toán(21)
    const thCols = [5, 6, 8, 9, 14, 18, 21];
    
    // Header for output
    const thHeader = ['Số hóa đơn', 'Mã khách hàng', 'Tên đơn vị mua hàng', 'Họ và tên người mua', 'Tổng tiền thanh toán', 'Người tạo', 'Hình thức thanh toán'];
    outWsThTong.addRow(thHeader);
    outWsThChuyenKhoan.addRow(thHeader);
    outWsThTienMat.addRow(thHeader);

    let thDataStarted = false;
    wsTongHop.eachRow((row, rowNumber) => {
      // Find where data starts (after header)
      if (rowNumber > 5) {
        thDataStarted = true;
      }
      if (thDataStarted) {
        const values = row.values as any[];
        if (values && values[5]) { // Has 'Số hoá đơn'
          const rowData = thCols.map(col => values[col]);
          const hinhThuc = values[21] ? values[21].toString().toLowerCase() : '';
          
          outWsThTong.addRow(rowData);

          if (hinhThuc.includes('chuyển khoản')) {
            outWsThChuyenKhoan.addRow(rowData);
          } else if (hinhThuc.includes('tiền mặt')) {
            outWsThTienMat.addRow(rowData);
          }
        }
      }
    });

    // --- Xử lý Bảng kê chi tiết ---
    const wbChiTiet = new ExcelJS.Workbook();
    await wbChiTiet.xlsx.load(chiTietBuffer as any);
    const wsChiTiet = wbChiTiet.worksheets[0];

    const outWbChiTiet = new ExcelJS.Workbook();
    const outWsCtTong = outWbChiTiet.addWorksheet('Tổng');
    const outWsCtChuyenKhoan = outWbChiTiet.addWorksheet('Chuyển Khoản');
    const outWsCtTienMat = outWbChiTiet.addWorksheet('Tiền Mặt');

    // Các cột cần lấy: 5, 6, 9, 11, 12, 13, 15, 16, 25, 29, 32
    const ctCols = [5, 6, 9, 11, 12, 13, 15, 16, 25, 29, 32];
    const ctHeader = ['Số hoá đơn', 'Mã khách hàng', 'Họ và tên mua hàng', 'Mã hàng hoá', 'Tên hàng hoá', 'Nội dung hàng hoá', 'Số lượng', 'Đơn giá', 'Tổng tiền thanh toán', 'Người tạo', 'Hình thức thanh toán'];
    outWsCtTong.addRow(ctHeader);
    outWsCtChuyenKhoan.addRow(ctHeader);
    outWsCtTienMat.addRow(ctHeader);

    // Thu thập dữ liệu và gom nhóm theo Số hoá đơn
    const ctDataGrouped = new Map<string, any[][]>();
    
    let ctDataStarted = false;
    wsChiTiet.eachRow((row, rowNumber) => {
      if (rowNumber > 5) {
        ctDataStarted = true;
      }
      if (ctDataStarted) {
        const values = row.values as any[];
        const soHoaDon = values[5];
        if (soHoaDon) {
          const soHoaDonStr = soHoaDon.toString().trim();
          if (!ctDataGrouped.has(soHoaDonStr)) {
            ctDataGrouped.set(soHoaDonStr, []);
          }
          // extract only the requested columns
          const rowData = ctCols.map(col => values[col]);
          ctDataGrouped.get(soHoaDonStr)!.push(rowData);
        }
      }
    });

    // Lọc theo yêu cầu:
    // "xóa cho tôi các cột có số hóa đơn trùng nhau chỉ giữ lại 1 nếu nội dung hàng hóa của dòng đó có chữ L1 
    // và sẽ xóa các cột có mã hóa đơn trùng mà không có L1"
    
    // ctCols mapping:
    // Nội dung hàng hoá là ctCols index 5 (13 in original)
    // Hình thức thanh toán là ctCols index 10 (32 in original)
    
    const finalCtRows: any[][] = [];
    
    for (const [soHoaDon, rows] of ctDataGrouped.entries()) {
      if (rows.length === 1) {
        // Không trùng
        finalCtRows.push(rows[0]);
      } else if (rows.length > 1) {
        // Trùng -> tìm dòng có "L1" trong nội dung hàng hóa
        const rowWithL1 = rows.find(r => {
          const noiDung = r[5];
          return noiDung && typeof noiDung === 'string' && noiDung.includes('L1');
        });
        
        if (rowWithL1) {
          finalCtRows.push(rowWithL1);
        }
        // Nếu không có L1, bỏ qua (xóa tất cả các dòng trùng không có L1)
      }
    }

    // Phân loại vào 2 sheet theo hình thức thanh toán
    for (const row of finalCtRows) {
      outWsCtTong.addRow(row);
      const hinhThuc = row[10] ? row[10].toString().toLowerCase() : '';
      if (hinhThuc.includes('chuyển khoản')) {
        outWsCtChuyenKhoan.addRow(row);
      } else if (hinhThuc.includes('tiền mặt')) {
        outWsCtTienMat.addRow(row);
      }
    }

    // Xuất ra Base64
    const thBufferOut = await outWbTongHop.xlsx.writeBuffer();
    const ctBufferOut = await outWbChiTiet.xlsx.writeBuffer();

    return NextResponse.json({
      tongHopBase64: Buffer.from(thBufferOut as any).toString('base64'),
      chiTietBase64: Buffer.from(ctBufferOut as any).toString('base64')
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý file' }, { status: 500 });
  }
}
