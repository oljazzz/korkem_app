import { useEffect } from 'react'

/**
 * Sets the browser tab's title while the page is open. "Print → Save as PDF" proposes it as the
 * file name, so a printed document should carry its own name ("Жүкқұжат № 7286, 09.11.2026").
 * Characters a file name cannot hold are replaced; the previous title comes back on leaving.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
    return () => {
      document.title = previous
    }
  }, [title])
}
