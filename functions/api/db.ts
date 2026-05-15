interface Env {
  COLD_STORAGE: R2Bucket
  EMAIL_PREFIX: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const prefix = context.env.EMAIL_PREFIX || "emails/gmail"
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
