import { useState, useEffect } from 'react'
import { Task, today } from '../types'

interface Props {
  task?: Task | null
  allTasks: Task[]
  onSave: (data: Omit<Task, 'id' | 'completed' | 'completedDate'>) => void
  onClose: () => void
}

export default function TaskModal({ task, allTasks, onSave, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [createdDate, setCreatedDate] = useState(today())
  const [dueDate, setDueDate] = useState(today())
  const [dependsOn, setDependsOn] = useState<string[]>([])

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setCreatedDate(task.createdDate)
      setDueDate(task.dueDate)
      setDependsOn(task.dependsOn)
    } else {
      setTitle(''); setDescription(''); setCreatedDate(today()); setDueDate(today()); setDependsOn([])
    }
  }, [task])

  function toggleDep(id: string) {
    setDependsOn(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return
    onSave({ title: title.trim(), description: description.trim(), createdDate, dueDate, dependsOn })
  }

  // Candidates: all tasks except the one being edited (can't depend on itself)
  const candidates = allTasks.filter(t => t.id !== task?.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white border-4 border-black shadow-brutal-lg w-full max-w-lg mx-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-yellow-300 border-b-4 border-black px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-black uppercase tracking-wider">
            {task ? '// EDIT TASK' : '// NEW TASK'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 border-2 border-black font-black text-lg flex items-center justify-center hover:bg-black hover:text-yellow-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter task title..."
              required
              className="w-full px-3 py-2 font-mono text-sm focus:outline-none focus:bg-yellow-50 bg-white"
              style={{ border: '3px solid black' }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={3}
              className="w-full px-3 py-2 font-mono text-sm focus:outline-none focus:bg-yellow-50 bg-white resize-none"
              style={{ border: '3px solid black' }}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest mb-1">Created Date</label>
              <input
                type="date"
                value={createdDate}
                onChange={e => setCreatedDate(e.target.value)}
                className="w-full px-3 py-2 font-mono text-sm focus:outline-none focus:bg-yellow-50 bg-white"
                style={{ border: '3px solid black' }}
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest mb-1">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 font-mono text-sm focus:outline-none focus:bg-yellow-50 bg-white"
                style={{ border: '3px solid black' }}
              />
            </div>
          </div>

          {/* Dependencies */}
          {candidates.length > 0 && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest mb-1">
                Depends On
                <span className="opacity-40 ml-2 normal-case">(tasks that must come before this one)</span>
              </label>
              <div
                className="border-black bg-white overflow-y-auto max-h-36 divide-y-2 divide-black"
                style={{ border: '3px solid black' }}
              >
                {candidates.map(t => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-yellow-50 transition-colors"
                  >
                    <div
                      className={`w-4 h-4 border-2 border-black flex items-center justify-center font-black text-xs transition-colors shrink-0
                        ${dependsOn.includes(t.id) ? 'bg-black text-yellow-300' : 'bg-white'}`}
                    >
                      {dependsOn.includes(t.id) ? '✓' : ''}
                    </div>
                    <input
                      type="checkbox"
                      checked={dependsOn.includes(t.id)}
                      onChange={() => toggleDep(t.id)}
                      className="hidden"
                    />
                    <span className="text-xs font-black uppercase truncate">{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-black text-yellow-300 font-black uppercase tracking-wider py-3 border-4 border-black hover:bg-yellow-300 hover:text-black transition-colors shadow-brutal-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {task ? 'SAVE CHANGES' : 'ADD TASK'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 bg-white font-black uppercase tracking-wider py-3 border-4 border-black hover:bg-gray-100 transition-colors shadow-brutal-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
