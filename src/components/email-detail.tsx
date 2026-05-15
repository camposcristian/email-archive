import { useState, useEffect } from "react"
import type { EmailEntry, ParsedEmail } from "../types/email"
import { formatDate, formatSize } from "../lib/utils"
import {
  X,
  Download,
  Paperclip,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react"

interface EmailDetailProps {
  email: EmailEntry
  onClose: () => void
}

export function EmailDetail({ email, onClose }: EmailDetailProps) {
  const [parsed, setParsed] = useState<ParsedEmail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setParsed(null)

    fetch(`/api/email/${email.r2Key}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load email: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setParsed(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [email.r2Key])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-card shadow-2xl">
        {/* Dialog Header */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {email.subject || "(no subject)"}
            </h2>
            <div className="mt-1.5 space-y-0.5 text-sm">
              <p>
                <span className="font-medium text-foreground">From:</span>{" "}
                <span className="text-muted-foreground">{parsed?.from || email.from}</span>
              </p>
              <p>
                <span className="font-medium text-foreground">To:</span>{" "}
                <span className="text-muted-foreground">{parsed?.to || email.to}</span>
              </p>
              {parsed?.cc && (
                <p>
                  <span className="font-medium text-foreground">CC:</span>{" "}
                  <span className="text-muted-foreground">{parsed.cc}</span>
                </p>
              )}
              <p>
                <span className="font-medium text-foreground">Date:</span>{" "}
                <span className="text-muted-foreground">
                  {formatDate(email.date)} &middot;{" "}
                  {formatSize(email.sizeEstimate)}
                </span>
              </p>
            </div>
          </div>

          <div className="ml-4 flex items-center gap-2">
            {/* Download .eml */}
            <a
              href={`/api/email/${email.r2Key}?raw=1`}
              download={`${email.id}.eml`}
              className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Download .eml"
            >
              <Download className="h-4 w-4" />
            </a>
            {/* Toggle raw/rendered */}
            <button
              onClick={() => setShowRaw((v) => !v)}
              className={`rounded-md border p-2 transition-colors hover:bg-accent hover:text-foreground ${showRaw ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              title="Toggle raw text"
            >
              <FileText className="h-4 w-4" />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Attachments bar */}
        {parsed?.attachments && parsed.attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/50 px-6 py-2">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            {parsed.attachments.map((att, i) => (
              <a
                key={i}
                href={`/api/email/${email.r2Key}?attachment=${i}`}
                download={att.filename}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent cursor-pointer"
                title={`Download ${att.filename}`}
              >
                <Download className="h-3 w-3 text-muted-foreground" />
                {att.filename || "attachment"}
                <span className="text-muted-foreground">
                  ({formatSize(att.size)})
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Email Body */}
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading email...
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center gap-2 py-20 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {parsed && !showRaw && parsed.html && (
            <div className="bg-white">
              <iframe
                sandbox="allow-popups"
                srcDoc={`<!DOCTYPE html><html><head><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;background:#fff;margin:0;padding:16px;line-height:1.6;font-size:14px}img{max-width:100%;height:auto}a{color:#2563eb}</style></head><body>${parsed.html}</body></html>`}
                className="h-full w-full border-0"
                style={{ minHeight: "500px" }}
                title="Email content"
              />
            </div>
          )}

          {parsed && (showRaw || !parsed.html) && (
            <pre className="whitespace-pre-wrap p-6 text-sm leading-relaxed text-foreground">
              {parsed.text || "(no text content)"}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
