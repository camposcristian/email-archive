interface Env {
  COLD_STORAGE: R2Bucket
  EMAIL_PREFIX?: string
}

// Archive id = a single path segment under emails/. Restricted so a client can
// never point the reader outside the emails/ namespace.
const ARCHIVE_ID = /^[a-zA-Z0-9_.-]+$/

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const archive = url.searchParams.get("archive")

  let prefix: string
  if (archive) {
    if (!ARCHIVE_ID.test(archive)) {
      return new Response("Invalid archive", { status: 400 })
    }
    prefix = `emails/${archive}`
  } else {
    prefix = context.env.EMAIL_PREFIX || "emails/gmail"
  }

  const object = await context.env.COLD_STORAGE.get(`${prefix}/index.db`)
  if (!object) {
    return new Response("Index DB not found", { status: 404 })
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Cache-Control": "public, max-age=300",
    },
  })
}
