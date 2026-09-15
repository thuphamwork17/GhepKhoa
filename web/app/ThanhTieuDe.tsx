import Image from "next/image";
import Link from "next/link";

export const TEN_TRUONG = "Trường Cao đẳng Tây Đô";
export const TEN_TRUNG_TAM =
  "Trung tâm GDNN Đào tạo & Sát hạch lái xe cơ giới đường bộ Tây Đô";

/**
 * Huy hiệu tròn, nền trong suốt nên đặt trên nền trắng là đọc rõ nhất.
 *
 * `dan` là nơi bấm vào logo sẽ tới. Bỏ trống khi logo đã nằm sẵn trong một
 * link khác — lồng hai thẻ <a> vào nhau là HTML sai và React sẽ cảnh báo.
 */
export function Logo({ co = 56, dan }: { co?: number; dan?: string }) {
  const anh = (
    <Image
      src="/logo-tay-do.png"
      alt={TEN_TRUONG}
      width={co}
      height={co}
      priority
      className="shrink-0"
      style={{ width: co, height: co }}
    />
  );
  return dan ? (
    <Link href={dan} className="shrink-0 transition hover:opacity-80">
      {anh}
    </Link>
  ) : (
    anh
  );
}

/** Dải màu lấy từ hai tông chính của logo, dùng khép chân thanh tiêu đề. */
export function DaiMau() {
  return (
    <div
      className="h-[3px]"
      style={{ background: "linear-gradient(to right, #0a4878 0%, #0b5590 55%, #fbad42 100%)" }}
    />
  );
}

/** Thanh tiêu đề dùng chung cho các trang học viên nhìn thấy. */
export function ThanhTieuDe() {
  return (
    <header className="bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-4">
        {/* Cả logo lẫn tên đơn vị đều bấm được, đưa về trang đăng ký. */}
        <Link
          href="/"
          className="flex items-center gap-4 rounded-md transition hover:opacity-80"
        >
          <Logo co={58} />
          <span className="block leading-tight">
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a8494]">
              {TEN_TRUONG}
            </span>
            <span className="mt-0.5 block text-[15px] font-bold text-[#0b5590] sm:text-[17px]">
              {TEN_TRUNG_TAM}
            </span>
          </span>
        </Link>
      </div>
      <DaiMau />
    </header>
  );
}
