import Link from "next/link";
import { redirect } from "next/navigation";

import { nguoiDangNhap, phamViDonVi } from "@/lib/auth";
import { dsDonVi, dsDot, type Dot } from "@/lib/db";
import { ngayISO, ngayVN } from "@/lib/kiemtra";
import {
  TEN_THU,
  bienThang,
  chuanHoaThang,
  dichThang,
  luoiThang,
  tenThang,
} from "@/lib/lich";
import { xoaDot } from "../../actions";
import FormDot from "./FormDot";

export const dynamic = "force-dynamic";

/* Mỗi đơn vị một màu để nhìn lịch là biết ngay đợt của bên nào. */
const MAU_DON_VI = [
  { vien: "border-[#0b5590]", nen: "bg-[#eaf2f9]", chu: "text-[#0b5590]", cham: "bg-[#0b5590]" },
  { vien: "border-[#c98a1f]", nen: "bg-[#fdf4e4]", chu: "text-[#8a5f13]", cham: "bg-[#fbad42]" },
];

export default async function Trang({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; ngay?: string; donvi?: string }>;
}) {
  const nd = await nguoiDangNhap();
  if (!nd) redirect("/dang-nhap");
  const pv = phamViDonVi(nd);

  const sp = await searchParams;
  const thang = chuanHoaThang(sp.thang);
  const { tu, den } = bienThang(thang);
  const ngayChon = /^\d{4}-\d{2}-\d{2}$/.test(sp.ngay ?? "") ? sp.ngay! : "";
  const locDonVi = pv === undefined ? Number(sp.donvi) || 0 : 0;

  // Lấy TẤT CẢ đợt trong phạm vi được xem, không giới hạn tháng: lưới chỉ vẽ
  // tháng đang mở, nhưng còn cần biết đơn vị nào có đợt ở tháng khác để chỉ
  // đường sang đó — nếu không, mở tháng 8 sẽ tưởng bên Trường chưa có đợt nào.
  const [tatCaDot, donVis] = await Promise.all([
    dsDot({ donViId: pv }),
    pv === undefined ? dsDonVi() : Promise.resolve([]),
  ]);

  const trongThang = tatCaDot.filter((d) => {
    const s = ngayISO(d.NgayThi);
    return s >= tu && s <= den;
  });
  // Lưới và bảng bên chịu bộ lọc đơn vị; còn con số trên chip thì đếm từ
  // `trongThang` chưa lọc, nếu không thì bật lọc một bên sẽ thấy bên kia
  // hiện (0) và tưởng tháng đó không có đợt.
  const dotThang = locDonVi ? trongThang.filter((d) => d.DonViId === locDonVi) : trongThang;

  // Màu gán theo DonViId cố định (không theo thứ tự xuất hiện trong tháng),
  // để đổi tháng thì màu của mỗi đơn vị vẫn y nguyên.
  const thuTuDonVi = [...new Set(tatCaDot.map((d) => d.DonViId))].sort((a, b) => a - b);
  const mauCua = new Map(
    thuTuDonVi.map((id, i) => [id, MAU_DON_VI[i % MAU_DON_VI.length]] as const),
  );
  const tenDonVi = new Map(tatCaDot.map((d) => [d.DonViId, d.TenVietTat] as const));

  /** Đợt gần ngày đầu tháng đang xem nhất, dùng để chỉ đường khi tháng này trống. */
  const gonNhat = (id: number) => {
    const ds = tatCaDot.filter((d) => d.DonViId === id);
    if (!ds.length) return null;
    return ds.reduce((a, b) =>
      Math.abs(+new Date(ngayISO(a.NgayThi)) - +new Date(tu)) <=
      Math.abs(+new Date(ngayISO(b.NgayThi)) - +new Date(tu))
        ? a
        : b,
    );
  };

  const theoNgay = new Map<string, Dot[]>();
  for (const d of dotThang) {
    const k = ngayISO(d.NgayThi);
    theoNgay.set(k, [...(theoNgay.get(k) ?? []), d]);
  }

  const o = luoiThang(thang);
  const dv = locDonVi ? `&donvi=${locDonVi}` : "";
  const q = (t: string, n?: string) =>
    `/admin/dot?thang=${t}${n ? `&ngay=${n}` : ""}${dv}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="border-b border-[#dfe4ec] pb-5">
        <h1 className="text-[20px] font-bold text-[#0b5590]">Lịch thi ghép khóa</h1>
        <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-[#5c6878]">
          Bấm vào một ngày để mở đợt thi cho ngày đó. Mã khóa ghi ở đây chính là mã sẽ in vào
          tiêu đề danh sách dự thi, ví dụ{" "}
          <code className="rounded bg-[#eaf2f9] px-1.5 py-0.5 text-[13px] text-[#0b5590]">
            BK100
          </code>
          .
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* ------------------------------------------------------ lịch -- */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Link
              href={q(dichThang(thang, -1), ngayChon)}
              className="rounded-lg border border-[#c8d2e0] px-3 py-1.5 text-[14px] text-[#4a5666] transition hover:bg-[#eaf2f9]"
            >
              ← Tháng trước
            </Link>
            <h2 className="px-2 text-[17px] font-bold text-[#0b5590]">{tenThang(thang)}</h2>
            <Link
              href={q(dichThang(thang, 1), ngayChon)}
              className="rounded-lg border border-[#c8d2e0] px-3 py-1.5 text-[14px] text-[#4a5666] transition hover:bg-[#eaf2f9]"
            >
              Tháng sau →
            </Link>
            <Link
              href={q(chuanHoaThang(undefined))}
              className="ml-auto rounded-lg px-3 py-1.5 text-[13px] text-[#0b5590] underline underline-offset-4"
            >
              Về tháng này
            </Link>
          </div>

          {/* Mỗi đơn vị một dòng: màu, số đợt trong tháng này, và nếu tháng
              này trống thì chỉ luôn sang tháng có đợt gần nhất. */}
          {thuTuDonVi.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
              {pv === undefined && (
                <Link
                  href={`/admin/dot?thang=${thang}${ngayChon ? `&ngay=${ngayChon}` : ""}`}
                  className={`rounded-full border px-2.5 py-1 ${
                    locDonVi === 0
                      ? "border-[#0b5590] bg-[#0b5590] font-medium text-white"
                      : "border-[#c8d2e0] text-[#4a5666] hover:bg-[#eaf2f9]"
                  }`}
                >
                  Tất cả
                </Link>
              )}
              {thuTuDonVi.map((id) => {
                const mau = mauCua.get(id)!;
                const soTrongThang = trongThang.filter((d) => d.DonViId === id).length;
                const gan = gonNhat(id);
                const ganIso = gan ? ngayISO(gan.NgayThi) : "";
                return (
                  <span key={id} className="flex items-center gap-2">
                    {pv === undefined ? (
                      <Link
                        href={`/admin/dot?thang=${thang}${ngayChon ? `&ngay=${ngayChon}` : ""}&donvi=${id}`}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                          locDonVi === id
                            ? "border-[#0b5590] bg-[#0b5590] font-medium text-white"
                            : "border-[#c8d2e0] text-[#4a5666] hover:bg-[#eaf2f9]"
                        }`}
                      >
                        <span className={`size-2.5 rounded-full ${mau.cham}`} />
                        {tenDonVi.get(id)}
                        <span className="opacity-70">({soTrongThang})</span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[#5c6878]">
                        <span className={`size-2.5 rounded-full ${mau.cham}`} />
                        {tenDonVi.get(id)} ({soTrongThang})
                      </span>
                    )}

                    {soTrongThang === 0 && ganIso && (
                      <Link
                        href={q(ganIso.slice(0, 7), ganIso)}
                        className="text-[#8a5f13] underline underline-offset-2"
                      >
                        tháng này trống → xem {ngayVN(ganIso)}
                      </Link>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          <div className="the overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-7 border-b border-[#dfe4ec] bg-[#f7f9fc]">
                {TEN_THU.map((t) => (
                  <div
                    key={t}
                    className="px-2 py-2 text-center text-[12px] font-semibold uppercase tracking-wide text-[#5c6878]"
                  >
                    {t}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {o.map((c) => {
                const ds = theoNgay.get(c.iso) ?? [];
                const dangChon = c.iso === ngayChon;
                return (
                  <Link
                    key={c.iso}
                    href={q(thang, c.iso)}
                    scroll={false}
                    className={`min-h-[92px] border-b border-r border-[#eef1f5] p-1.5 transition last:border-r-0 ${
                      dangChon
                        ? "bg-[#eaf2f9] ring-2 ring-inset ring-[#0b5590]"
                        : c.trongThang
                          ? c.laCuoiTuan
                            ? "bg-[#fcfdfe] hover:bg-[#f2f6fb]"
                            : "bg-white hover:bg-[#f2f6fb]"
                          : "bg-[#fafbfc]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums ${
                          c.laHomNay
                            ? "bg-[#0b5590] font-bold text-white"
                            : c.trongThang
                              ? "font-medium text-[#17202e]"
                              : "text-[#c3cad4]"
                        }`}
                      >
                        {c.ngay}
                      </span>
                      {c.trongThang && ds.length === 0 && (
                        <span className="pr-0.5 text-[15px] leading-none text-[#c3cad4]">+</span>
                      )}
                    </div>

                    <div className="mt-1 space-y-1">
                      {ds.map((d) => {
                        const mau = mauCua.get(d.DonViId) ?? MAU_DON_VI[0];
                        return (
                          <div
                            key={d.DotId}
                            className={`rounded border-l-[3px] px-1.5 py-1 text-[11px] leading-tight ${mau.vien} ${mau.nen} ${mau.chu}`}
                          >
                            <span className="block font-bold">{d.MaKhoaDich}</span>
                            <span className="block opacity-80">
                              {d.SoDangKy} ĐK
                              {d.SoLuongToiDa ? `/${d.SoLuongToiDa}` : ""}
                              {!d.ConNhanDangKy && " · đóng"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          </div>
        </section>

        {/* ------------------------------------------------- bảng bên -- */}
        <aside className="space-y-6">
          <section className="the p-5 shadow-[0_1px_3px_rgba(11,85,144,0.08)]">
            <h2 className="mb-1 text-[14px] font-bold uppercase tracking-wide text-[#0b5590]">
              {ngayChon ? "Mở đợt thi" : "Thêm đợt mới"}
            </h2>
            <p className="mb-4 border-b border-[#dfe4ec] pb-3 text-[13px] text-[#5c6878]">
              {ngayChon ? (
                <>
                  Ngày thi:{" "}
                  <span className="font-semibold text-[#17202e]">{ngayVN(ngayChon)}</span>{" "}
                  <Link href={q(thang)} className="ml-1 text-[#0b5590] underline underline-offset-2">
                    đổi
                  </Link>
                </>
              ) : (
                "Bấm một ngày trên lịch để điền sẵn ngày thi."
              )}
            </p>
            <FormDot
              donVis={donVis.map((d) => ({ id: d.DonViId, ten: d.TenDayDu }))}
              donViCoDinh={pv ? { id: pv, ten: nd.TenVietTat ?? "" } : null}
              ngayThiMacDinh={ngayChon}
            />
          </section>

          <section className="the overflow-hidden">
            <h2 className="border-b border-[#dfe4ec] bg-[#f7f9fc] px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide text-[#5c6878]">
              Đợt trong {tenThang(thang).toLowerCase()}
            </h2>
            {dotThang.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-[#7a8494]">
                Chưa có đợt nào trong tháng này.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef1f5]">
                {dotThang.map((d) => (
                  <li key={d.DotId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-semibold text-[#0b5590]">
                          {d.MaKhoaDich}
                          <span className="ml-2 text-[12px] font-normal text-[#7a8494]">
                            {ngayVN(d.NgayThi)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#5c6878]">
                          {d.TenVietTat} · {d.SoDangKy} đăng ký
                          {d.SoLuongToiDa ? ` / ${d.SoLuongToiDa}` : ""}
                          {d.HanDangKy ? ` · hạn ĐK ${ngayVN(d.HanDangKy)}` : ""}
                        </p>
                      </div>
                      <form action={xoaDot}>
                        <input type="hidden" name="id" value={d.DotId} />
                        <button className="text-[12px] text-[#8f2a1d] underline underline-offset-2 hover:no-underline">
                          Xóa
                        </button>
                      </form>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          d.ConNhanDangKy
                            ? "border-[#a9cfae] bg-[#f1f8f2] text-[#215c2c]"
                            : "border-[#d5dbe4] bg-[#f4f6f9] text-[#5c6878]"
                        }`}
                      >
                        {d.ConNhanDangKy ? "Đang nhận" : d.DangMo ? "Ngưng nhận" : "Đã đóng"}
                      </span>
                      <Link
                        href={`/admin?dot=${d.DotId}`}
                        className="text-[12px] text-[#0b5590] underline underline-offset-2"
                      >
                        Xem đăng ký
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
