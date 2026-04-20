import { Task, getTaskStatus } from '../types'

interface Props {
  tasks: Task[]
}

export default function StatsBar({ tasks }: Props) {
  const total = tasks.length
  const done = tasks.filter(t => t.completed).length
  const overdue = tasks.filter(t => getTaskStatus(t) === 'overdue').length
  const pending = tasks.filter(t => getTaskStatus(t) === 'pending').length

  const stats = [
    { label: 'TOTAL', value: total, cls: 'bg-white' },
    { label: 'PENDING', value: pending, cls: 'bg-blue-400' },
    { label: 'DONE', value: done, cls: 'bg-green-400' },
    { label: 'OVERDUE', value: overdue, cls: overdue > 0 ? 'bg-red-500 text-white' : 'bg-red-100' },
  ]

  return (
    <div className="flex gap-2">
      {stats.map(s => (
        <div key={s.label} className={`${s.cls} border-4 border-black shadow-brutal-sm px-4 py-1 text-center min-w-[60px]`}>
          <div className="text-lg font-black leading-tight">{s.value}</div>
          <div className="text-xs font-black uppercase tracking-widest opacity-60 leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
