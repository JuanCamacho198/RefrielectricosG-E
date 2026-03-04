import type { Metadata } from "next";
import { 
  Roboto, 
  Inter, 
  Poppins, 
  Montserrat, 
  Open_Sans, 
  Lato, 
  Raleway, 
  Playfair_Display, 
  Merriweather 
} from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeProvider } from "@/components/theme-provider";
import QueryProvider from "@/components/providers/QueryProvider";
import GoogleAuthProvider from "@/components/providers/GoogleAuthProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

const inter = Inter({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

const montserrat = Montserrat({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

const openSans = Open_Sans({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-open-sans',
});

const lato = Lato({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lato',
});

const raleway = Raleway({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-raleway',
});

const playfairDisplay = Playfair_Display({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair-display',
});

const merriweather = Merriweather({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-merriweather',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://refrielectricos.com'),
  title: {
    template: '%s | Refrielectricos',
    default: 'Refrielectricos | Repuestos de Refrigeración y Electricidad',
  },
  description: "Tienda especializada en repuestos de refrigeración, aire acondicionado y electricidad. Envíos a todo el país.",
  keywords: ['refrigeración', 'electricidad', 'repuestos', 'aire acondicionado', 'herramientas'],
  icons: {
    icon: '/images/RefriLogo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: 'https://refrielectricos.com',
    siteName: 'Refrielectricos',
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Preload LCP Image - Hero Carousel */}
        <link
          rel="preload"
          as="image"
          href="/images/carrusel2.jpg"
          fetchPriority="high"
        />
        {/* Preconnect para mejorar LCP - Backend API */}
        <link
          rel="preconnect"
          href="https://paginawebrefrielectricos-v2-production.up.railway.app"
          crossOrigin="anonymous"
        />
        {/* Preconnect para Cloudinary CDN */}
        <link
          rel="preconnect"
          href="https://res.cloudinary.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://res.cloudinary.com"
        />
        {/* Google Identity Services */}
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className={`${roboto.variable} ${inter.variable} ${poppins.variable} ${montserrat.variable} ${openSans.variable} ${lato.variable} ${raleway.variable} ${playfairDisplay.variable} ${merriweather.variable} font-sans antialiased bg-gray-50 dark:bg-gray-900 transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <GoogleAuthProvider>
            <QueryProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </QueryProvider>
          </GoogleAuthProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
