#!/usr/bin/env node
// Direct Cloudflare Pages deployment via REST API (v2 with blake3).
// Works around wrangler pages deploy ignoring CLOUDFLARE_ACCOUNT_ID.
//
// Usage: node cf_pages_deploy_v2.mjs <project-name> <dist-dir> [--branch=main]

import fs from "node:fs";
import path from "node:path";
import { blake3 } from "hash-wasm";

const projectName = process.argv[2];
const distDir = path.resolve(process.argv[3]);
const branch =
  process.argv.find((a) => a.startsWith("--branch="))?.split("=")[1] ?? "main";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!projectName || !distDir || !accountId || !token) {
  console.error("need: <project> <dist> + CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN");
  process.exit(2);
}

const API = "https://api.cloudflare.com/client/v4";

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push({ full, rel: "/" + path.relative(base, full).replaceAll(path.sep, "/") });
  }
  return out;
}

function ctypeOf(p) {
  const ext = path.extname(p).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
    ".txt": "text/plain; charset=utf-8", ".map": "application/json",
  })[ext] ?? "application/octet-stream";
}

// Cloudflare Pages hash: blake3 of (contentType + file extension + base64(content)), first 32 hex
async function cfPagesHash(body, ext) {
  const b64 = body.toString("base64");
  const input = b64 + ext;
  const full = await blake3(input);
  return full.slice(0, 32);
}

async function main() {
  const files = walk(distDir);
  console.log(`Files: ${files.length}`);

  // 1. Get upload JWT
  const jwtRes = await fetch(
    `${API}/accounts/${accountId}/pages/projects/${projectName}/upload-token`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const jwtBody = await jwtRes.json();
  if (!jwtBody.success) {
    console.error("upload-token failed:", JSON.stringify(jwtBody.errors));
    process.exit(1);
  }
  const jwt = jwtBody.result.jwt;

  // 2. Build payload: hash every file
  const manifest = {};
  const payload = [];
  for (const f of files) {
    const body = fs.readFileSync(f.full);
    const ext = path.extname(f.full).slice(1);
    const hash = await cfPagesHash(body, ext);
    manifest[f.rel] = hash;
    payload.push({
      key: hash,
      value: body.toString("base64"),
      metadata: { contentType: ctypeOf(f.full) },
      base64: true,
    });
  }

  // 3. Check which hashes Cloudflare already has (upload-check endpoint)
  const checkRes = await fetch("https://api.cloudflare.com/client/v4/pages/assets/check-missing", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hashes: Object.values(manifest) }),
  });
  const checkBody = await checkRes.json();
  if (!checkBody.success) {
    console.error("check-missing failed:", JSON.stringify(checkBody.errors));
    process.exit(1);
  }
  const missing = new Set(checkBody.result ?? []);
  console.log(`Missing hashes: ${missing.size}/${Object.keys(manifest).length}`);

  // 4. Upload missing assets in batches
  const toUpload = payload.filter((p) => missing.has(p.key));
  if (toUpload.length > 0) {
    const uploadRes = await fetch("https://api.cloudflare.com/client/v4/pages/assets/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toUpload),
    });
    const uploadBody = await uploadRes.json();
    if (!uploadBody.success) {
      console.error("upload failed:", JSON.stringify(uploadBody.errors));
      process.exit(1);
    }
    console.log(`Uploaded ${toUpload.length} assets`);
  } else {
    console.log("No new assets to upload");
  }

  // 5. Register upload completion
  const finalizeRes = await fetch("https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hashes: Object.values(manifest) }),
  });
  const finalizeBody = await finalizeRes.json();
  if (!finalizeBody.success) {
    console.error("upsert-hashes failed:", JSON.stringify(finalizeBody.errors));
    process.exit(1);
  }

  // 6. Create deployment with manifest
  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  form.append("branch", branch);

  const depRes = await fetch(
    `${API}/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  const depBody = await depRes.json();
  if (!depBody.success) {
    console.error("deployment failed:", JSON.stringify(depBody.errors));
    process.exit(1);
  }
  console.log(`✨ Deployed: ${depBody.result.url}`);
  console.log(`Id: ${depBody.result.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
