import { useState, useEffect, useCallback } from "react"
import { loadDb, queryEmails, getStats, type QueryResult, type DbStats } from "@/lib/email-db"
import { SearchBar } from "@/components/search-bar"
import { StatsBar } from "@/components/stats-bar"
import { EmailList } from "@/components/email-list"
import { EmailDetail } from "@/components/email-detail"
import { Pagination } from "@/components/pagination"
import { FloeMark } from "@/components/floe-mark"
import type { EmailEntry } from "@/types/email"

const PER_PAGE = 50

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<"date" | "from" | "subject" | "size">("date")
  const [order, setOrder] = useState<"asc" | "desc">("desc")
  const [result, setResult] = useState<QueryResult>({ emails: [], total: 0, page: 1, pages: 0 })
  const [stats, setStats] = useState<DbStats>({ total: 0, totalSize: 0, categories: [] })
  const [selectedEmail, setSelectedEmail] = useState<EmailEntry | null>(null)
  const [category, setCategory] = useState("")

  useEffect(() => {
    loadDb()
      .then(() => {
        setStats(getStats())
        setResult(queryEmails({ page: 1, perPage: PER_PAGE, sort: "date", order: "desc" }))
        setLoading(false)
      })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [])

  const runQuery = useCallback((s: string, p: number, so: string, o: string, cat: string) => {
    setResult(queryEmails({
      page: p,
      perPage: PER_PAGE,
      sort: so as "date",
      order: o as "asc",
      search: s || undefined,
      category: cat || undefined,
    }))
  }, [])

  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
    runQuery(v, 1, sort, order, category)
  }

  function handleSort(col: "date" | "from" | "subject" | "size") {
    const newOrder = col === sort && order === "desc" ? "asc" : "desc"
    setSort(col)
    setOrder(newOrder)
    runQuery(search, page, col, newOrder, category)
  }

  function handlePage(p: number) {
    setPage(p)
    runQuery(search, p, sort, order, category)
  }

  function handleCategoryClick(cat: string) {
    const next = category === cat ? "" : cat
    setCategory(next)
    setPage(1)
    runQuery(search, 1, sort, order, next)
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">Failed to load archive</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center gap-4">
        <FloeMark className="h-12 w-12 shrink-0" />
        <div>
          <h1 className="font-display text-2xl font-bold italic tracking-tight">Floe</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading archive…" : "the mail archive"}
          </p>
        </div>
      </header>

      <div className="space-y-4">
        <SearchBar value={search} onChange={handleSearch} />
        <StatsBar
          total={stats.total}
          filtered={result.total}
          searching={!!search}
          categories={stats.categories}
          activeCategory={category}
          onCategoryClick={handleCategoryClick}
        />
        <EmailList
          emails={result.emails}
          onSelect={setSelectedEmail}
          loading={loading}
          sort={sort}
          order={order}
          onSort={handleSort}
        />
        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          perPage={PER_PAGE}
          onPageChange={handlePage}
        />
      </div>

      {selectedEmail && <EmailDetail email={selectedEmail} onClose={() => setSelectedEmail(null)} />}
    </div>
  )
}
