import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'

/** Shows a one-off success message passed via navigation state ({ notice }) and clears it. */
export function Notice() {
  const location = useLocation()
  const navigate = useNavigate()
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const notice = (location.state as { notice?: string } | null)?.notice
    if (!notice) return
    setText(notice)
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    if (!text) return
    const t = setTimeout(() => setText(null), 4000)
    return () => clearTimeout(t)
  }, [text])

  if (!text) return null
  return (
    <div className="notice" role="status">
      <Icon name="check" />
      <span>{text}</span>
      <button className="icon-btn" aria-label="Жабу" onClick={() => setText(null)}><Icon name="close" size={16} /></button>
    </div>
  )
}
