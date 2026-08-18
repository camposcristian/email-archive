import initSqlJs, { type Database } from "sql.js"
import type { EmailEntry } from "@/types/email"

let db: Database | null = null
let loading: Promise<Database> | null = null
let loadedArchive: string | null = null

export interface ArchiveList {
  archives: string[]
  default: string
}

export async function listArchives(): Promise<ArchiveList> {
  const res = await fetch("/api/archives")
  if (!res.ok) throw new Error(`Failed to list archives: ${res.status}`)
  return res.json()
}

export interface QueryResult {
  emails: EmailEntry[]
  total: number
  page: number
  pages: number
}

export interface QueryOptions {
  page?: number
  perPage?: number
  sort?: "date" | "from" | "subject" | "size"
  order?: "asc" | "desc"
  search?: string
  category?: string
}

export interface DbStats {
  total: number
  totalSize: number
  categories: [string, number][]
}

const SORT_MAP: Record<string, string> = {
  date: "date_unix",
  from: "sender",
  subject: "subject",
  size: "size_estimate",
}

// `archive` selects which index to read (see /api/archives). Passing a
// different archive than the one in memory swaps the loaded database; passing
// the same one (or none) reuses it.
export async function loadDb(archive?: string): Promise<Database> {
  const want = archive ?? null
  if (db && loadedArchive === want) return db
  if (loading && loadedArchive === want) return loading

  loadedArchive = want
  loading = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/${file}`,
    })

    const res = await fetch(want ? `/api/db?archive=${encodeURIComponent(want)}` : "/api/db")
    if (!res.ok) throw new Error(`Failed to load index: ${res.status}`)

    const buf = await res.arrayBuffer()
    db?.close()
    db = new SQL.Database(new Uint8Array(buf))
    return db
  })()

  return loading
}

export function queryEmails(opts: QueryOptions = {}): QueryResult {
  if (!db) return { emails: [], total: 0, page: 1, pages: 0 }

  const page = opts.page || 1
  const perPage = opts.perPage || 50
  const offset = (page - 1) * perPage
  const col = SORT_MAP[opts.sort || "date"] || "date_unix"
  const dir = opts.order === "asc" ? "ASC" : "DESC"

  const conditions: string[] = []
  const countParams: (string | number)[] = []
  let paramIdx = 1

  if (opts.category) {
    conditions.push(`category = ?${paramIdx}`)
    countParams.push(opts.category)
    paramIdx++
  }

  if (opts.search?.trim()) {
    const like = `%${opts.search.trim()}%`
    conditions.push(`(subject LIKE ?${paramIdx} OR sender LIKE ?${paramIdx} OR recipient LIKE ?${paramIdx} OR snippet LIKE ?${paramIdx})`)
    countParams.push(like)
    paramIdx++
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const countSql = `SELECT COUNT(*) as total FROM emails ${where}`
  const dataSql = `SELECT * FROM emails ${where} ORDER BY ${col} ${dir} LIMIT ?${paramIdx} OFFSET ?${paramIdx + 1}`

  const countResult = db.exec(countSql, countParams)
  const total = countResult[0]?.values[0]?.[0] as number || 0

  const dataResult = db.exec(dataSql, [...countParams, perPage, offset])
  const emails = rowsToEmails(dataResult)

  return { emails, total, page, pages: Math.ceil(total / perPage) }
}

export function getStats(): DbStats {
  if (!db) return { total: 0, totalSize: 0, categories: [] }

  const totalResult = db.exec("SELECT COUNT(*) as total, COALESCE(SUM(size_estimate), 0) as s FROM emails")
  const total = totalResult[0]?.values[0]?.[0] as number || 0
  const totalSize = totalResult[0]?.values[0]?.[1] as number || 0

  const catResult = db.exec(`
    SELECT category, COUNT(*) as count
    FROM emails WHERE category != ''
    GROUP BY category ORDER BY count DESC
  `)

  const categories: [string, number][] = catResult[0]?.values.map(
    (row) => [row[0] as string, row[1] as number]
  ) || []

  return { total, totalSize, categories }
}

function rowsToEmails(result: ReturnType<Database["exec"]>): EmailEntry[] {
  if (!result[0]) return []
  const cols = result[0].columns
  return result[0].values.map((row) => {
    const obj: Record<string, unknown> = {}
    cols.forEach((col, i) => { obj[col] = row[i] })
    return {
      id: obj.id as string,
      threadId: (obj.thread_id as string) || "",
      subject: (obj.subject as string) || "",
      from: (obj.sender as string) || "",
      to: (obj.recipient as string) || "",
      date: (obj.date as string) || "",
      snippet: (obj.snippet as string) || "",
      sizeEstimate: (obj.size_estimate as number) || 0,
      r2Key: (obj.r2_key as string) || "",
    }
  })
}
