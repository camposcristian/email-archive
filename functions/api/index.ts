interface Env {
  COLD_STORAGE: R2Bucket
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const object = await context.env.COLD_STORAGE.get(
    "emails/gmail/index.json"
  )

  if (!object) {
    return new Response("Index not found", { status: 404 })
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300", // 5 min cache
    },
  })
}
