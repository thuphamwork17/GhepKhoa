import sql from "mssql";

/**
 * Một pool kết nối duy nhất cho cả tiến trình.
 *
 * Next.js ở chế độ dev nạp lại module liên tục, nên pool được giữ trên
 * globalThis — nếu không, mỗi lần sửa file lại mở thêm một pool và SQL Express
 * sẽ hết chỗ kết nối.
 */

const G = globalThis as unknown as {
  __gkPool?: Promise<sql.ConnectionPool>;
  __gkPoolTrungTam?: Promise<sql.ConnectionPool>;
  __gkPoolTruong?: Promise<sql.ConnectionPool>;
};

function caiDat(): sql.config {
  const thieu: string[] = [];
  const lay = (ten: string, macDinh?: string) => {
    const v = process.env[ten] ?? macDinh;
    if (v === undefined || v === "") thieu.push(ten);
    return v ?? "";
  };

  const server = lay("SQL_MAY_CHU", "localhost");
  const database = lay("SQL_CSDL", "DrivingManagement");
  const user = lay("SQL_NGUOI_DUNG");
  const password = lay("SQL_MAT_KHAU");
  const port = Number(process.env.SQL_CONG ?? 1433);

  if (thieu.length) {
    throw new Error(
      `Thiếu cấu hình kết nối SQL Server: ${thieu.join(", ")}. ` +
        `Khai báo trong web/.env.local — xem sql/thiet_lap_ket_noi.ps1.`,
    );
  }

  return {
    server,
    port,
    database,
    user,
    password,
    options: {
      // SQL Express thường dùng chứng chỉ tự ký
      trustServerCertificate: process.env.SQL_TIN_CHUNG_CHI !== "0",
      encrypt: true,
      appName: "GhepKhoa",
      // driver mặc định đã bật, ghi rõ cho khỏi phụ thuộc phiên bản
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    requestTimeout: 30_000,
    connectionTimeout: 15_000,
  };
}

export function pool(): Promise<sql.ConnectionPool> {
  if (!G.__gkPool) {
    G.__gkPool = new sql.ConnectionPool(caiDat())
      .connect()
      .catch((e) => {
        G.__gkPool = undefined; // cho phép thử lại ở lần gọi sau
        throw e;
      });
  }
  return G.__gkPool;
}

export type ThamSo = Record<string, { kieu: sql.ISqlType | (() => sql.ISqlType); gt: unknown }>;

/** Chạy một câu truy vấn có tham số, trả về mảng bản ghi. */
export async function truyVan<T = Record<string, unknown>>(
  cau: string,
  thamSo: ThamSo = {},
): Promise<T[]> {
  const p = await pool();
  const r = p.request();
  for (const [ten, { kieu, gt }] of Object.entries(thamSo)) r.input(ten, kieu, gt);
  const kq = await r.query<T>(cau);
  return kq.recordset ?? [];
}

/** Chạy truy vấn và lấy đúng bản ghi đầu tiên. */
export async function motDong<T = Record<string, unknown>>(
  cau: string,
  thamSo: ThamSo = {},
): Promise<T | undefined> {
  return (await truyVan<T>(cau, thamSo))[0];
}

/* --- KẾT NỐI ĐẾN TRUNG TÂM (CHITHANH) VÀ TRƯỜNG (cdtd) --- */

export function poolTrungTam(): Promise<sql.ConnectionPool> {
  if (!G.__gkPoolTrungTam) {
    G.__gkPoolTrungTam = new sql.ConnectionPool({
      server: "CHITHANH",
      database: "GPLX_CSDT",
      user: "sa",
      password: "123456",
      options: { 
        instanceName: "SQLEXPRESS",
        encrypt: false, 
        trustServerCertificate: true, 
        enableArithAbort: true 
      },
      requestTimeout: 15_000,
      connectionTimeout: 10_000,
    })
      .connect()
      .catch((e) => {
        G.__gkPoolTrungTam = undefined;
        throw e;
      });
  }
  return G.__gkPoolTrungTam;
}

export function poolTruong(): Promise<sql.ConnectionPool> {
  if (!G.__gkPoolTruong) {
    G.__gkPoolTruong = new sql.ConnectionPool({
      server: "cdtd",
      database: "GPLX_CSDT",
      user: "sa",
      password: "123456",
      options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
      requestTimeout: 15_000,
      connectionTimeout: 5_000,
    })
      .connect()
      .catch((e) => {
        G.__gkPoolTruong = undefined;
        throw e;
      });
  }
  return G.__gkPoolTruong;
}

export async function truyVanTrungTam<T = Record<string, unknown>>(
  cau: string,
  thamSo: ThamSo = {},
): Promise<T[]> {
  try {
    const p = await poolTrungTam();
    const r = p.request();
    for (const [ten, { kieu, gt }] of Object.entries(thamSo)) r.input(ten, kieu, gt);
    const kq = await r.query<T>(cau);
    return kq.recordset ?? [];
  } catch (err) {
    console.error("Lỗi truy vấn Trung Tâm:", err);
    return []; // Trả về rỗng nếu không kết nối được
  }
}

export async function truyVanTruong<T = Record<string, unknown>>(
  cau: string,
  thamSo: ThamSo = {},
): Promise<T[]> {
  try {
    const p = await poolTruong();
    const r = p.request();
    for (const [ten, { kieu, gt }] of Object.entries(thamSo)) r.input(ten, kieu, gt);
    const kq = await r.query<T>(cau);
    return kq.recordset ?? [];
  } catch (err) {
    console.error("Lỗi truy vấn Trường:", err);
    return []; // Trả về rỗng nếu mạng nội bộ của Trường không truy cập được
  }
}

/** Gọi stored procedure. Trả về { ra, banGhi } — ra là các tham số OUTPUT. */
export async function goiThuTuc<T = Record<string, unknown>>(
  ten: string,
  vao: ThamSo = {},
  ra: Record<string, sql.ISqlType | (() => sql.ISqlType)> = {},
): Promise<{ ra: Record<string, unknown>; banGhi: T[] }> {
  const p = await pool();
  const r = p.request();
  for (const [k, { kieu, gt }] of Object.entries(vao)) r.input(k, kieu, gt);
  for (const [k, kieu] of Object.entries(ra)) r.output(k, kieu);
  const kq = await r.execute<T>(ten);
  return { ra: kq.output ?? {}, banGhi: kq.recordset ?? [] };
}

/**
 * Lỗi do stored procedure chủ động THROW (mã 50001–50999) là lỗi nghiệp vụ,
 * nội dung đã viết sẵn bằng tiếng Việt để hiện thẳng cho người dùng. Mọi lỗi
 * khác là sự cố kỹ thuật, không được để lộ chi tiết ra ngoài.
 */
export function loiNghiepVu(e: unknown): string | null {
  const so = (e as { number?: number })?.number;
  if (typeof so === "number" && so >= 50001 && so <= 50999) {
    return (e as Error).message;
  }
  return null;
}

export { sql };
