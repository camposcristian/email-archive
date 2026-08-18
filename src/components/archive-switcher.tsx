interface ArchiveSwitcherProps {
  archives: string[]
  active: string
  onSelect: (archive: string) => void
  disabled?: boolean
}

// Friendly labels for the archive ids we ship tooling for; anything else falls
// back to the raw id (so a hand-made `emails/whatever/` archive still shows up).
const ARCHIVE_LABEL: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  fastmail: "Fastmail",
}

export function ArchiveSwitcher({ archives, active, onSelect, disabled }: ArchiveSwitcherProps) {
  // One archive is the normal case — no point rendering a switcher for it.
  if (archives.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Archive</span>
      {archives.map((a) => (
        <button
          key={a}
          onClick={() => onSelect(a)}
          disabled={disabled}
          aria-pressed={active === a}
          className={`rounded-full border px-2 py-0.5 transition-colors disabled:opacity-50 ${
            active === a
              ? "border-accent bg-accent text-accent-foreground"
              : "hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {ARCHIVE_LABEL[a] || a}
        </button>
      ))}
    </div>
  )
}
