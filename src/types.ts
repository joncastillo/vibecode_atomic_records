export interface Task {
  id: string
  title: string
  description: string
  createdDate: string // YYYY-MM-DD
  dueDate: string     // YYYY-MM-DD
  completed: boolean
  completedDate?: string
  dependsOn: string[]
}

export interface Project {
  id: string
  name: string
  color: string    // hex
  createdAt: string
  taskCount: number
}

export type TaskStatus = 'pending' | 'completed' | 'overdue'

export function getTaskStatus(task: Task): TaskStatus {
  if (task.completed) return 'completed'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(task.dueDate + 'T00:00:00')
  if (due < today) return 'overdue'
  return 'pending'
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export const PROJECT_PALETTE = [
  '#FFE500', '#FF3B3B', '#3B9EFF', '#38E54D',
  '#FF8C00', '#9B5DE5', '#FF6B9D', '#00CED1',
]

export const OVERALL_PROJECT_ID = '__overall__'
export const OVERALL_PROJECT: Project = {
  id: OVERALL_PROJECT_ID,
  name: 'OVERALL',
  color: '#E2E8F0',
  createdAt: '',
  taskCount: 0,
}
