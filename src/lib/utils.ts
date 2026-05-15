import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/)
  return match ? match[1] : from
}

export function extractDomain(from: string): string {
  const email = extractEmail(from)
  const atIdx = email.lastIndexOf("@")
  if (atIdx === -1) return ""
  return email.substring(atIdx + 1).toLowerCase()
}

export function extractName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : extractEmail(from)
}
