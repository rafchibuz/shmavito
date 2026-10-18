import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ШМАВИТО — предложка STEEL",
  description: "Находки с Avito, отобранные сообществом STEEL.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
