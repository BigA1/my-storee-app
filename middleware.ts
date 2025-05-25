import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session and trying to access protected route, redirect to login
  if (!session && req.nextUrl.pathname.startsWith('/timeline')) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Add Supabase token to FastAPI requests
  if (session?.access_token && req.nextUrl.pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('Authorization', `Bearer ${session.access_token}`)
    
    // You can also add other headers if needed
    requestHeaders.set('X-User-ID', session.user.id)
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return res
}

// Specify which routes should be protected
export const config = {
  matcher: [
    '/timeline/:path*',
    '/profile/:path*',
    '/api/:path*',
  ],
}