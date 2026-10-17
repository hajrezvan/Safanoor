import { NextResponse } from 'next/server';

export function middleware() {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  return NextResponse.next();
}

export const config = { matcher: ['/dev/design/:path*'] };
