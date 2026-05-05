import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import LoginModalWrapper from "@/components/LoginModalWrapper";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Valle Grande FC | Dashboard Administrativo",
  description: "Gestión documental de jugadores del Club Valle Grande FC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isRegistro = pathname === "/registro";

  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 min-h-screen`}>
        <AuthProvider>
          {children}
          {!isRegistro && <LoginModalWrapper />}
        </AuthProvider>
      </body>
    </html>
  );
}
