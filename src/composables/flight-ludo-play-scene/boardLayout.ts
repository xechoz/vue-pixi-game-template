import type { BoardRenderLayout } from '../../game'
import type { BoardLayout } from './types'

type BoardPresetLayoutInput = {
  trackLength: number
  stepsPerEdge: number
  homeSteps: number
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t
}

function buildLinePoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  count: number,
) {
  if (count <= 1) return [{ x: start.x, y: start.y }]

  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1)
    return {
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
    }
  })
}

function buildPerimeterPoints(
  left: number,
  right: number,
  top: number,
  bottom: number,
  stepsPerEdge: number,
) {
  const topSide = buildLinePoints({ x: left, y: top }, { x: right, y: top }, stepsPerEdge)
  const rightSide = buildLinePoints({ x: right, y: top }, { x: right, y: bottom }, stepsPerEdge)
  const bottomSide = buildLinePoints({ x: right, y: bottom }, { x: left, y: bottom }, stepsPerEdge)
  const leftSide = buildLinePoints({ x: left, y: bottom }, { x: left, y: top }, stepsPerEdge)

  return {
    topSide,
    rightSide,
    bottomSide,
    leftSide,
    perimeterPoints: [
      ...topSide,
      ...rightSide.slice(1),
      ...bottomSide.slice(1),
      ...leftSide.slice(1),
    ],
  }
}

export function buildBoardLayout(
  originX: number,
  originY: number,
  size: number,
  boardPreset: BoardPresetLayoutInput,
  boardRenderLayout: BoardRenderLayout,
): BoardLayout {
  console.log('Building board layout with preset:', boardPreset, 'and render layout:', boardRenderLayout, "origin:", originX, originY, "size:", size)

  const trackInset = size * boardRenderLayout.trackInsetRatio
  const left = originX + trackInset
  const right = originX + size - trackInset
  const top = originY + trackInset
  const bottom = originY + size - trackInset
  const centerX = originX + size / 2
  const centerY = originY + size / 2

  const { topSide, rightSide, bottomSide, leftSide, perimeterPoints } = buildPerimeterPoints(
    left,
    right,
    top,
    bottom,
    boardPreset.stepsPerEdge,
  )

  // 外圈路径：保持闭合矩形外环，左侧只比其它三边少一个点，用来匹配当前 trackLength。
  const leftRouteSide = buildLinePoints(
    { x: left, y: bottom },
    { x: left, y: top },
    boardPreset.stepsPerEdge
  )

  const trackPoints = [
    ...topSide,
    ...rightSide.slice(1),
    ...bottomSide.slice(1),
    ...leftRouteSide.slice(1),
  ]

  const outerBorderPoints = perimeterPoints

  const buildBaseSlots = () => {
    const spread = size * boardRenderLayout.baseSlotSpreadRatio
    const quadrantInset = size * boardRenderLayout.baseZonePaddingRatio
    const quadrantBounds = [
      {
        minX: left + quadrantInset,
        maxX: centerX - quadrantInset,
        minY: top + quadrantInset,
        maxY: centerY - quadrantInset,
      },
      {
        minX: centerX + quadrantInset,
        maxX: right - quadrantInset,
        minY: top + quadrantInset,
        maxY: centerY - quadrantInset,
      },
      {
        minX: centerX + quadrantInset,
        maxX: right - quadrantInset,
        minY: centerY + quadrantInset,
        maxY: bottom - quadrantInset,
      },
      {
        minX: left + quadrantInset,
        maxX: centerX - quadrantInset,
        minY: centerY + quadrantInset,
        maxY: bottom - quadrantInset,
      },
    ]

    return quadrantBounds.map((bounds) => {
      const slotCenterX = (bounds.minX + bounds.maxX) / 2
      const slotCenterY = (bounds.minY + bounds.maxY) / 2
      return [
        { x: slotCenterX - spread, y: slotCenterY - spread },
        { x: slotCenterX + spread, y: slotCenterY - spread },
        { x: slotCenterX - spread, y: slotCenterY + spread },
        { x: slotCenterX + spread, y: slotCenterY + spread },
      ]
    })
  }

  const buildFinishSlots = (originXValue: number, originYValue: number) => {
    const slotCenterX = originXValue + size / 2
    const slotCenterY = originYValue + size / 2
    const finishGap = size * boardRenderLayout.finishGapRatio

    const laneAnchors = [
      leftSide[Math.floor((leftSide.length - 1) / 2)] ?? leftSide[0] ?? { x: left, y: centerY },
      topSide[Math.floor((topSide.length - 1) / 2)] ?? topSide[0] ?? { x: centerX, y: top },
      rightSide[Math.floor((rightSide.length - 1) / 2)] ?? rightSide[0] ?? { x: right, y: centerY },
      bottomSide[Math.floor((bottomSide.length - 1) / 2)] ?? bottomSide[0] ?? { x: centerX, y: bottom },
    ]

    const getFinishTarget = (anchor: { x: number; y: number }) => {
      const dx = slotCenterX - anchor.x
      const dy = slotCenterY - anchor.y
      const distance = Math.hypot(dx, dy)

      if (distance === 0) {
        return { x: slotCenterX, y: slotCenterY }
      }

      const targetDistance = Math.max(0, distance - finishGap)
      const scale = targetDistance / distance

      return {
        x: anchor.x + dx * scale,
        y: anchor.y + dy * scale,
      }
    }

    return laneAnchors.map((anchor) => {
      const finishTarget = getFinishTarget(anchor)

      return Array.from({ length: boardPreset.homeSteps }, (_, laneIndex) => {
        const t = (laneIndex + 1) / boardPreset.homeSteps
        return {
          x: lerp(anchor.x, finishTarget.x, t),
          y: lerp(anchor.y, finishTarget.y, t),
        }
      })
    })
  }

  const homeEntryPoints = [
    leftSide[Math.floor((leftSide.length - 1) / 2)] ?? leftSide[0] ?? { x: left, y: centerY },
    topSide[Math.floor((topSide.length - 1) / 2)] ?? topSide[0] ?? { x: centerX, y: top },
    rightSide[Math.floor((rightSide.length - 1) / 2)] ?? rightSide[0] ?? { x: right, y: centerY },
    bottomSide[Math.floor((bottomSide.length - 1) / 2)] ?? bottomSide[0] ?? { x: centerX, y: bottom },
  ]

  return {
    trackPoints,
    outerBorderPoints,
    topBorderPoints: topSide,
    rightBorderPoints: rightSide,
    bottomBorderPoints: bottomSide,
    leftBorderPoints: leftSide,
    homeEntryPoints,
    baseSlots: buildBaseSlots(),
    finishSlots: buildFinishSlots(originX, originY),
  }
}
