export type Point = {
  x: number
  y: number
}

export type BoardLayout = {
  trackPoints: Point[]
  baseSlots: Point[][]
  finishSlots: Point[][]
}
