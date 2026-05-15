export interface EmailEntry {
  id: string
  threadId: string
  date: string
  from: string
  to: string
  subject: string
  snippet: string
  sizeEstimate: number
  r2Key: string
}

export interface ParsedEmail {
  from: string
  to: string
  cc?: string
  date: string
  subject: string
  html?: string
  text?: string
  attachments: Attachment[]
}

export interface Attachment {
  filename: string
  mimeType: string
  size: number
  index: number
}
