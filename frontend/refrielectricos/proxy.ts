import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that should bypass maintenance mode
const BYPASS_ROUTES = [
  '/api',           // API routes
  '/admin',         // Admin panel
  '/_next',         // Next.js internal
  '/images',        // Static images
  '/favicon.ico',
  '/globe.svg',
];

// Admin role check paths (these users can bypass maintenance)
const ADMIN_PATHS = ['/admin'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route should bypass maintenance mode
  const shouldBypass = BYPASS_ROUTES.some(route => pathname.startsWith(route));
  
  if (shouldBypass) {
    return NextResponse.next();
  }

  // Fetch maintenance mode status from API
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const response = await fetch(`${apiUrl}/settings`, {
      headers: {
        'Cache-Control': 'no-cache',
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (response.ok) {
      const settings = await response.json();
      
      // If maintenance mode is enabled
      if (settings.maintenanceMode === true) {
        // Check if user is trying to access admin
        const isAdminPath = ADMIN_PATHS.some(path => pathname.startsWith(path));
        
        // Allow admin users to bypass (they're already logged in)
        if (isAdminPath) {
          return NextResponse.next();
        }

        // Redirect all other users to maintenance page
        if (pathname !== '/maintenance') {
          return NextResponse.redirect(new URL('/maintenance', request.url));
        }
      } else {
        // If maintenance mode is OFF and user is on maintenance page, redirect to home
        if (pathname === '/maintenance') {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    }
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    // On error, allow access (fail open)
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
