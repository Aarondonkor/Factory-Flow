import { useEffect, useRef } from 'react'

/**
 * Keeps a page's data current without the user having to manually reload:
 * - refetches on an interval while the tab is visible
 * - refetches immediately when the tab regains focus/visibility
 *
 * Pass the same fetch function you already call on mount; this hook does not
 * call it on mount itself, so keep your existing `useEffect(() => { fetchData() }, [])`
 * alongside it.
 */
export function useAutoRefresh(fetchFn: () => void | Promise<void>, intervalMs = 30000) {
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchRef.current()
      }
    }, intervalMs)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchRef.current()
      }
    }
    const handleFocus = () => {
      fetchRef.current()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [intervalMs])
}
