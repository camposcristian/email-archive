interface Env {
  COLD_STORAGE: R2Bucket
  EMAIL_PREFIX?: string
}

// Auto-discover archives: any `emails/<id>/index.db` object in the bucket is an
// archive the viewer can switch to. Adding a new provider (e.g. archiving
// Outlook to `emails/outlook/`) makes it appear here automatically — no config.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const listed = await context.env.COLD_STORAGE.list({
    prefix: "emails/",
    delimiter: "/",
  })

  const archives: string[] = []
  for (const p of listed.delimitedPrefixes) {
    // p looks like "emails/gmail/"
    const head = await context.env.COLD_STORAGE.head(`${p}index.db`)
    if (head) archives.push(p.slice("emails/".length).replace(/\/$/, ""))
  }
  archives.sort()

  // Which one the default (no ?archive=) request resolves to, so the client can
  // pre-select it.
  const def = (context.env.EMAIL_PREFIX || "emails/gmail").replace(/^emails\//, "")

  return new Response(JSON.stringify({ archives, default: def }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  })
}
