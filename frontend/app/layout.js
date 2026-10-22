import "./globals.css";
import Link from "next/link";
import { Hanken_Grotesk, Noto_Sans_Devanagari } from "next/font/google";

const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva" });

export const metadata = { title: "Speech to Text", description: "Real-time Hindi + English transcription" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${deva.variable}`}>
        <nav className="nav">
          <b>Speech to Text</b>
          <Link href="/">Record</Link>
          <Link href="/dashboard">History</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
