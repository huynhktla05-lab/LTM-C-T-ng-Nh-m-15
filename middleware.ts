import { NextRequest, NextResponse } from 'next/server'
import StoreKeys from './lib/constants/storeKeys'

// Limit the middleware to paths not starting with `/api/` or `_next/static`...
export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|icons|assets|audio).*)',
    ],
}

const serverApiUrl = process.env.NEXT_PUBLIC_API_URL + '/api'

const authPaths = ['/signin', '/signup']
const publicPaths = ['/', '/contact']

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const inPublicPath = publicPaths.includes(pathname)

    console.log(`pathname ${pathname}`, `inPublicPath ${inPublicPath}`)
    if (inPublicPath) return NextResponse.next()

    const inAuthPath =
        authPaths.includes(pathname) || pathname.startsWith('/sign')
    console.log(`inAuthPath ${inAuthPath}`)

    const userToken = request.cookies.get(StoreKeys.ACCESS_TOKEN)?.value

    if (!userToken && inAuthPath) {
        return NextResponse.next()
    }

    if (userToken) {
        const onErrorRes = () => {
            const nextRes = NextResponse.redirect(
                new URL(authPaths.shift() ?? '/', request.url)
            )
            nextRes.cookies.delete(StoreKeys.ACCESS_TOKEN)
            nextRes.cookies.delete(StoreKeys.USER)
            return nextRes
        }

        try {
            const res = await fetch(`${serverApiUrl}/users/check-authorization`, {
                headers: {
                    Authorization: `Bearer ${userToken}`,
                },
            })

            if (!res.ok) {
                return onErrorRes()
            }

            const data = await res.json()
            const nextRes = inAuthPath
                ? NextResponse.redirect(new URL('/', request.url))
                : NextResponse.next()
            nextRes.cookies.set(StoreKeys.USER, JSON.stringify(data))
            return nextRes
        } catch (error) {
            console.error(error)
            return onErrorRes()
        }
    }

    return NextResponse.redirect(new URL(authPaths.shift() ?? '/', request.url))
}
