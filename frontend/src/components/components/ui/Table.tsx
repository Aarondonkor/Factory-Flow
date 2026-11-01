import type { ReactNode } from 'react'

interface ResponsiveTableProps {
  headers: string[]
  children: ReactNode
  emptyMessage?: string
  isEmpty?: boolean
}

export function ResponsiveTable({
  headers,
  children,
  emptyMessage = 'No records found',
  isEmpty,
}: ResponsiveTableProps) {
  if (isEmpty) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">{emptyMessage}</div>
    )
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              {headers.map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">{children}</div>
    </>
  )
}

export function TableRow({
  cells,
  mobileCard,
}: {
  cells: ReactNode[]
  mobileCard: ReactNode
}) {
  return (
    <>
      <tr className="hidden md:table-row hover:bg-slate-50">
        {cells.map((cell, i) => (
          <td key={i} className="px-4 py-3 text-slate-700">
            {cell}
          </td>
        ))}
      </tr>
      <div className="md:hidden card p-4">{mobileCard}</div>
    </>
  )
}
