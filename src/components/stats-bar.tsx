interface StatsBarProps {
  total: number
  filtered: number
  searching: boolean
  categories: [string, number][]
  activeCategory: string
  onCategoryClick: (category: string) => void
}

const CATEGORY_EMOJI: Record<string, string> = {
  Banking: "\u{1F3E6}",
  Crypto: "\u{1FA99}",
  Trading: "\u{1F4C8}",
  Payments: "\u{1F4B3}",
  Cards: "\u{1F4B3}",
  Accounting: "\u{1F4CB}",
  Recovery: "\u{2696}\u{FE0F}",
  Dev: "\u{1F4BB}",
  Other: "\u{1F4E7}",
}

export function StatsBar({
  total,
  filtered,
  searching,
  categories,
  activeCategory,
  onCategoryClick,
}: StatsBarProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium">
        {searching || activeCategory ? `${filtered} of ${total}` : total} archived
      </span>
      <span className="text-border">|</span>
      {categories.map(([cat, count]) => (
        <button
          key={cat}
          onClick={() => onCategoryClick(cat)}
          className={`rounded-full border px-2 py-0.5 transition-colors ${
            activeCategory === cat
              ? "border-accent bg-accent text-accent-foreground"
              : "hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {CATEGORY_EMOJI[cat] || ""} {cat} ({count})
        </button>
      ))}
    </div>
  )
}
