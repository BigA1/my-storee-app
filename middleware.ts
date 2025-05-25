import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: { path?: string; maxAge?: number }) {
          res.cookies.set({
            name,
            value,
            path: options.path || '/',
            maxAge: options.maxAge || 60 * 60 * 24 * 7,
          })
        },
        remove(name: string, options: { path?: string }) {
          res.cookies.set({
            name,
            value: '',
            path: options.path || '/',
            maxAge: 0,
          })
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-auth-token',
      }
    }
  )

  try {
    console.log('Middleware: Checking session for path:', req.nextUrl.pathname)
    
    // Refresh session if expired
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    console.log('Middleware: Session check result:', { 
      hasSession: !!session, 
      error: sessionError ? sessionError.message : null,
      path: req.nextUrl.pathname
    })

    if (sessionError) {
      console.error('Middleware: Session error:', sessionError)
      throw sessionError
    }

    // If no session and trying to access protected route, redirect to login
    if (!session && isProtectedRoute(req.nextUrl.pathname)) {
      console.log('Middleware: No session, redirecting to login')
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Add Supabase token to FastAPI requests
    if (session?.access_token && req.nextUrl.pathname.startsWith('/api/')) {
      console.log('Middleware: Adding auth headers for API request')
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('Authorization', `Bearer ${session.access_token}`)
      requestHeaders.set('X-User-ID', session.user.id)
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }

    console.log('Middleware: Proceeding with request')
    return res
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, redirect to login
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('error', 'session_error')
    return NextResponse.redirect(redirectUrl)
  }
}

function isProtectedRoute(pathname: string): boolean {
  const protectedRoutes = [
    '/timeline',
    '/profile',
    '/api'
  ]
  return protectedRoutes.some(route => pathname.startsWith(route))
}

// Specify which routes should be protected
export const config = {
  matcher: [
    '/timeline/:path*',
    '/profile/:path*',
    '/api/:path*',
  ],
}