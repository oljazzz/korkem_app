import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Stops in-app navigation (sidebar, links, back button) and tab close while there are unsaved changes.
 * Render a confirmation while `blocker.state === 'blocked'`; call `allowNextNavigation()` right before
 * navigating away on purpose (e.g. after a successful save).
 */
export function useUnsavedGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty)
  const allowRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
    if (dirty) allowRef.current = false
  }, [dirty])

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        dirtyRef.current && !allowRef.current && currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  )

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const allowNextNavigation = useCallback(() => {
    allowRef.current = true
  }, [])

  return { blocker, allowNextNavigation }
}
