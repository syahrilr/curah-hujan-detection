import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) {
    return new Response("Missing url", { status: 400 })
  }

  const upstream = await fetch(url, {
    // Optional: user-agent to avoid being blocked
    headers: { "User-Agent": "v0-bmkg-proxy" },
    // Don't send credentials; we only proxy public radar images
    cache: "no-store",
  })

  if (!upstream.ok) {
    return new Response(`Upstream error: ${upstream.status}`, { status: 502 })
  }

  const contentType = upstream.headers.get("content-type") ?? "image/png"
  const buffer = await upstream.arrayBuffer()

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // short cache to smooth rapid requests, tweak as needed
      "Cache-Control": "public, max-age=60",
      // allow canvas usage from browser (fixes tainted canvas)
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  })
}
