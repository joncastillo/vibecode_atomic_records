import { Task } from './types'

export type Positions = Record<string, { x: number; y: number }>

export const CARD_W = 280
export const CARD_H = 188  // fallback estimate; actual heights are measured at runtime
const COL_GAP = 110
const ROW_GAP = 60         // more vertical breathing room for variable-height cards
const PADDING = 60

export function autoArrange(tasks: Task[]): Positions {
  const colOf = new Map<string, number>()

  function getCol(id: string, seen = new Set<string>()): number {
    if (colOf.has(id)) return colOf.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const task = tasks.find(t => t.id === id)
    if (!task || task.dependsOn.length === 0) { colOf.set(id, 0); return 0 }
    const col = Math.max(...task.dependsOn.map(d => getCol(d, new Set(seen)))) + 1
    colOf.set(id, col)
    return col
  }

  tasks.forEach(t => getCol(t.id))

  const rowsPerCol = new Map<number, number>()
  const result: Positions = {}

  tasks.forEach(t => {
    const col = colOf.get(t.id) ?? 0
    const row = rowsPerCol.get(col) ?? 0
    result[t.id] = {
      x: PADDING + col * (CARD_W + COL_GAP),
      y: PADDING + row * (CARD_H + ROW_GAP),
    }
    rowsPerCol.set(col, row + 1)
  })

  return result
}

export function findCardAt(
  graphX: number,
  graphY: number,
  tasks: Task[],
  positions: Positions,
  cardHeights?: Record<string, number>,
): string | null {
  for (const task of tasks) {
    const pos = positions[task.id]
    if (!pos) continue
    const h = cardHeights?.[task.id] ?? CARD_H
    if (graphX >= pos.x && graphX <= pos.x + CARD_W && graphY >= pos.y && graphY <= pos.y + h) {
      return task.id
    }
  }
  return null
}
