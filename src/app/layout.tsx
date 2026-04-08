import type { Metadata } from "next";
import "./globals.css";
import AuthWrapper from "@/components/AuthWrapper";

export const metadata: Metadata = {
  title: "Myxellia — 3D Real Estate Engine",
  description: "The future of real estate discovery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
