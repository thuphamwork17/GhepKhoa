import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Đăng ký thi tốt nghiệp ghép khóa",
  description:
    "Cổng đăng ký thi tốt nghiệp ghép khóa cho học viên chưa thi hoặc chưa đạt ở khóa cũ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full">
      <body className="flex min-h-full flex-col bg-white text-[#17202e]">{children}</body>
    </html>
  );
}
