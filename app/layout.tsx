import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KireiCode",
  description: "Understand your codebase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased min-h-screen`}
    >
      <body className="min-h-screen flex flex-col md:flex-row bg-[#0b0f14] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <Topbar />
          <main className="flex-1 w-full overflow-y-auto relative">
            <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8 relative">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
