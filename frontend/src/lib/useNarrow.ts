import { useEffect, useState } from 'react'

const QUERY = '(max-width: 760px)'

/** True on phone-width screens, where list rows open on a single tap. */
export function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}
