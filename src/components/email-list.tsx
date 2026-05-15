import type { EmailEntry } from "../types/email"
import { formatDate, formatSize, extractName, extractDomain } from "../lib/utils"

// Deterministic color from domain string — 12 muted hues
const LABEL_COLORS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/20",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  "bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/20",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/20",
]

function domainColor(domain: string): string {
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = ((hash << 5) - hash + domain.charCodeAt(i)) | 0
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length]
}
import { ArrowUpDown, Mail } from "lucide-react"

type SortCol = "date" | "from" | "subject" | "size"

interface EmailListProps {
  emails: EmailEntry[]
  onSelect: (email: EmailEntry) => void
  loading?: boolean
  sort: "date" | "from" | "subject" | "size"
  order: "asc" | "desc"
  onSort: (col: "date" | "from" | "subject" | "size") => void
}

export function EmailList({ emails, onSelect, loading, sort, order, onSort }: EmailListProps) {
  function SortHeader({
    label,
    field,
    className,
  }: {
    label: string
    field: SortCol
    className?: string
  }) {
    const active = sort === field
    return (
      <th
        className={`cursor-pointer select-none px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground ${className ?? ""}`}
        onClick={() => onSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown
            className={`h-3 w-3 ${active ? "text-foreground" : "opacity-30"}`}
            aria-label={active ? order : undefined}
          />
        </span>
      </th>
    )
  }

  if (!loading && emails.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Mail className="h-10 w-10 opacity-30" />
        <p className="text-sm">No emails match your search</p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 border-b bg-background">
        <tr>
          <SortHeader label="Date" field="date" className="w-28" />
          <SortHeader label="From" field="from" className="w-72" />
          <SortHeader label="Subject" field="subject" />
          <SortHeader label="Size" field="size" className="w-20 text-right" />
        </tr>
      </thead>
      <tbody>
        {emails.map((email) => (
          <tr
            key={email.id}
            onClick={() => onSelect(email)}
            className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50"
          >
            <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
              {formatDate(email.date)}
            </td>
            <td className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{extractName(email.from)}</span>
                {extractDomain(email.from) && (
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${domainColor(extractDomain(email.from))}`}
                  >
                    {extractDomain(email.from)}
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-2">
              <div className="truncate">{email.subject || "(no subject)"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {email.snippet}
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-muted-foreground">
              {formatSize(email.sizeEstimate)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
