import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FLIGHT_JUMPS,
  HOME_STEPS,
  PLAYER_DEFS,
  SAFE_CELLS,
  TRACK_LENGTH,
  createGame,
} from './flight-ludo.ts'

test('tiny-4 board preset uses a 16-cell track with 2 home steps and no flight jumps', () => {
  assert.equal(TRACK_LENGTH, 16)
  assert.equal(HOME_STEPS, 2)
  assert.deepEqual(
    PLAYER_DEFS.map((player) => player.startIndex),
    [0, 4, 8, 12],
  )
  assert.deepEqual([...SAFE_CELLS], [0, 4, 8, 12])
  assert.equal(FLIGHT_JUMPS.size, 0)
})

test('createGame still marks the first n seats as human-controlled in tiny-4 mode', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2 })
  assert.deepEqual(
    game.players.map((player) => player.humanControlled),
    [true, true, false, false],
  )
})

test('createGame accepts a non-default board preset id and stores it in the game state', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'normal-6' })

  assert.equal(game.boardPresetId, 'normal-6')
})
