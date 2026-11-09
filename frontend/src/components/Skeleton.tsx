/** Placeholder rows shown while a table loads for the first time, so the layout does not jump. */
export function SkeletonRows({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <span className="skeleton" style={{ width: `${[70, 40, 85, 55, 30][(r + c) % 5]}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Placeholder for a ranked list (dashboard top products / clients). */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton skeleton--line" style={{ width: `${95 - i * 9}%` }} />
      ))}
    </div>
  )
}
