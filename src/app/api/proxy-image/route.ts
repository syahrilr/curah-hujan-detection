export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")
  if (!url) return new Response("Missing url", { status: 400 })

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "v0-radar-proxy" },
      cache: "no-store",
    })
    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status })
    }
    const contentType = upstream.headers.get("content-type") || "image/png"
    const buf = await upstream.arrayBuffer()
    return new Response(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    })
  } catch {
    return new Response("Fetch failed", { status: 502 })
  }
}
