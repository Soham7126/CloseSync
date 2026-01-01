import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/signup', '/join'];

export async function middleware(request: NextRequest) {
    // Skip RSC payloads and internal Next.js requests
    const { pathname } = request.nextUrl;
    
    // Skip internal RSC and prefetch requests
    if (
        pathname.includes('_rsc') ||
        request.headers.get('RSC') === '1' ||
        request.headers.get('Next-Router-Prefetch') === '1'
    ) {
        return NextResponse.next();
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    const isPublicRoute = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + '/')
    );

    // Landing page (/) - allow access for everyone
    if (pathname === '/') {
        return response;
    }

    // Redirect to login if not authenticated and trying to access protected route
    if (!session && !isPublicRoute) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect to dashboard if authenticated and trying to access login/signup
    if (session && (pathname === '/login' || pathname === '/signup')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next (all Next.js internals)
         * - favicon.ico
         * - public assets
         * - api routes
         */
        '/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api).*)',
    ],
};
