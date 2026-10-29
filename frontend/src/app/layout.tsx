import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FraudCatcher - Enterprise AI",
  description: "Multi-Agent, ML & Graph Ensemble Fraud Detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}