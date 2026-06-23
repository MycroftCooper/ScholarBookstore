import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameScholarBookstore",
  description:
    "\u9762\u5411\u6e38\u620f\u7814\u7a76\u4e0e\u5f00\u53d1\u5b9e\u8df5\u7684\u77e5\u8bc6\u5e93\u793e\u533a\u7f51\u7ad9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
