#!/usr/bin/env node
/**
 * Local dev server for the Floe email archive viewer.
 *
 * Mirrors the Pages Functions API (functions/api/*) but fetches objects
 * directly from any S3-compatible bucket via the AWS SDK. No wrangler
 * dependency. Configure via .env (see .env.example).
 *
 * Caches fetched objects on disk so repeat opens are instant.
 */

import "dotenv/config"
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import PostalMime from "postal-mime"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT ?? "8788", 10)
const DIST_DIR = path.join(__dirname, "dist")
const CACHE_DIR = path.join(__dirname, ".local-cache")
const EMAIL_PREFIX = process.env.EMAIL_PREFIX || "emails/gmail"

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})
const BUCKET = process.env.S3_BUCKET

if (!BUCKET || !process.env.S3_ENDPOINT) {
  console.error("Missing S3_BUCKET or S3_ENDPOINT in .env — see .env.example")
  process.exit(1)
}

if (!fs.existsSync(DIST_DIR)) {
  console.error(`No dist/ directory. Run \`npm run build\` first.`)
  process.exit(1)
}
fs.mkdirSync(CACHE_DIR, { recursive: true })

// ─── S3 fetch with local cache ────────────────────────
async function s3Get(key) {
  const cachePath = path.join(CACHE_DIR, key.replace(/\//g, "__"))
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath)
  }
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const buf = Buffer.from(await resp.Body.transformToByteArray())
    fs.writeFileSync(cachePath, buf)
    return buf
  } catch (e) {
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null
    throw e
  }
}

// ─── MIME types for static assets ──────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
}

function serveStatic(req, res, urlPath) {
  const safePath = path.normalize(urlPath).replace(/^\/+/, "")
  const filePath = path.join(DIST_DIR, safePath)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" })
    fs.createReadStream(filePath).pipe(res)
    return
  }
  res.writeHead(200, { "Content-Type": MIME[".html"] })
  fs.createReadStream(path.join(DIST_DIR, "index.html")).pipe(res)
}

// ─── API: GET /api/db → index.db ─────────────────────
async function handleDb(res) {
  const buf = await s3Get(`${EMAIL_PREFIX}/index.db`)
  if (!buf) {
    res.writeHead(404, { "Content-Type": "text/plain" })
    res.end("Index DB not found")
    return
  }
  res.writeHead(200, {
    "Content-Type": "application/x-sqlite3",
    "Cache-Control": "public, max-age=300",
  })
  res.end(buf)
}

// ─── API: GET /api → index.json (legacy) ─────────────
async function handleIndex(res) {
  const buf = await s3Get(`${EMAIL_PREFIX}/index.json`)
  if (!buf) {
    res.writeHead(502, { "Content-Type": "text/plain" })
    res.end("Failed to fetch index.json")
    return
  }
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
  })
  res.end(buf)
}

// ─── API: GET /api/email/{path} → parsed email ───────
async function handleEmail(req, res, url) {
  const prefix = "/api/email/"
  const key = decodeURIComponent(url.pathname.slice(prefix.length))

  const buf = await s3Get(key)
  if (!buf) {
    res.writeHead(404)
    res.end("Email not found")
    return
  }

  if (url.searchParams.get("raw") === "1") {
    res.writeHead(200, {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="email.eml"`,
    })
    res.end(buf)
    return
  }

  const parser = new PostalMime()
  const parsed = await parser.parse(buf)

  const attIdx = url.searchParams.get("attachment")
  if (attIdx !== null) {
    const idx = parseInt(attIdx, 10)
    const att = parsed.attachments?.[idx]
    if (!att || !att.content) {
      res.writeHead(404)
      res.end("Attachment not found")
      return
    }
    res.writeHead(200, {
      "Content-Type": att.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${att.filename ?? `attachment-${idx}`}"`,
    })
    res.end(Buffer.from(att.content))
    return
  }

  const cidMap = {}
  const attachmentList = []
  const attachments = parsed.attachments ?? []
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i]
    if (att.contentId && att.content) {
      const base64 = Buffer.from(att.content).toString("base64")
      cidMap[att.contentId.replace(/^<|>$/g, "")] = `data:${att.mimeType};base64,${base64}`
    }
    attachmentList.push({
      filename: att.filename ?? "attachment",
      mimeType: att.mimeType,
      size: att.content?.byteLength ?? 0,
      index: i,
    })
  }

  let html = parsed.html ?? ""
  for (const [cid, dataUri] of Object.entries(cidMap)) {
    html = html.replace(
      new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"),
      dataUri
    )
  }

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
  })
  res.end(JSON.stringify({
    from: formatAddress(parsed.from),
    to: formatAddressList(parsed.to),
    cc: formatAddressList(parsed.cc),
    date: parsed.date,
    subject: parsed.subject,
    html,
    text: parsed.text,
    attachments: attachmentList,
  }))
}

function formatAddress(a) {
  if (!a) return ""
  return a.name ? `${a.name} <${a.address}>` : a.address ?? ""
}
function formatAddressList(list) {
  if (!list || list.length === 0) return ""
  return list.map(formatAddress).join(", ")
}

// ─── Server ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname

  try {
    if (p === "/api/db") { await handleDb(res); return }
    if (p === "/api" || p === "/api/") { await handleIndex(res); return }
    if (p.startsWith("/api/email/")) { await handleEmail(req, res, url); return }
    serveStatic(req, res, p)
  } catch (err) {
    console.error("Error handling", p, err)
    if (!res.headersSent) res.writeHead(500)
    res.end(`Server error: ${err.message}`)
  }
})

server.listen(PORT, () => {
  console.log(`\n📬 Floe running at http://localhost:${PORT}`)
  console.log(`   Bucket:  ${BUCKET} via ${process.env.S3_ENDPOINT}`)
  console.log(`   Prefix:  ${EMAIL_PREFIX}`)
  console.log(`   Cache:   ${CACHE_DIR}\n`)
})
