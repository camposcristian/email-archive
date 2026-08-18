import PostalMime from "postal-mime"

interface Env {
  COLD_STORAGE: R2Bucket
  EMAIL_PREFIX?: string
}

// Any key under emails/<archive-id>/… is readable, so the viewer can open mail
// from whichever archive is selected (see /api/archives). The archive segment is
// charset-restricted and the key may not contain ".." — together that keeps
// reads inside the emails/ namespace regardless of what the client sends.
const EMAIL_KEY = /^emails\/[a-zA-Z0-9_.-]+\/.+/

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const pathSegments = context.params.path
  if (!pathSegments || !Array.isArray(pathSegments)) {
    return new Response("Missing email path", { status: 400 })
  }

  const r2Key = pathSegments.join("/")

  if (!EMAIL_KEY.test(r2Key) || r2Key.includes("..")) {
    return new Response("Invalid email path", { status: 400 })
  }

  const object = await context.env.COLD_STORAGE.get(r2Key)
  if (!object) {
    return new Response("Email not found in R2", { status: 404 })
  }

  const url = new URL(context.request.url)

  // Raw download mode — full .eml file
  if (url.searchParams.get("raw") === "1") {
    return new Response(object.body, {
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="email.eml"`,
      },
    })
  }

  // Individual attachment download mode
  const attachmentIdx = url.searchParams.get("attachment")
  if (attachmentIdx !== null) {
    const rawBytes = await object.arrayBuffer()
    const parser = new PostalMime()
    const parsed = await parser.parse(rawBytes)
    const idx = parseInt(attachmentIdx, 10)
    const att = parsed.attachments?.[idx]
    if (!att || !att.content) {
      return new Response("Attachment not found", { status: 404 })
    }
    const filename = att.filename || `attachment-${idx}`
    return new Response(att.content, {
      headers: {
        "Content-Type": att.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  }

  // Parse the .eml file
  const rawBytes = await object.arrayBuffer()
  const parser = new PostalMime()
  const parsed = await parser.parse(rawBytes)

  // Build CID map for inline images
  const cidMap: Record<string, string> = {}
  const attachmentList: { filename: string; mimeType: string; size: number; index: number }[] = []

  for (let i = 0; i < (parsed.attachments || []).length; i++) {
    const att = parsed.attachments[i]
    // If attachment has a contentId, create a data URI for inline rendering
    if (att.contentId && att.content) {
      const base64 = bufferToBase64(att.content)
      cidMap[att.contentId.replace(/^<|>$/g, "")] = `data:${att.mimeType};base64,${base64}`
    }
    attachmentList.push({
      filename: att.filename || "attachment",
      mimeType: att.mimeType,
      size: att.content?.byteLength || 0,
      index: i,
    })
  }

  // Replace cid: references in HTML with data URIs
  let html = parsed.html || ""
  for (const [cid, dataUri] of Object.entries(cidMap)) {
    html = html.replace(new RegExp(`cid:${escapeRegex(cid)}`, "gi"), dataUri)
  }

  const result = {
    from: formatAddresses(parsed.from),
    to: formatAddressList(parsed.to),
    cc: formatAddressList(parsed.cc),
    date: parsed.date,
    subject: parsed.subject,
    html,
    text: parsed.text,
    attachments: attachmentList,
  }

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

function formatAddresses(
  addr: { name?: string; address?: string } | undefined
): string {
  if (!addr) return ""
  if (addr.name) return `${addr.name} <${addr.address}>`
  return addr.address || ""
}

function formatAddressList(
  addrs: { name?: string; address?: string }[] | undefined
): string {
  if (!addrs || addrs.length === 0) return ""
  return addrs.map((a) => formatAddresses(a)).join(", ")
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
