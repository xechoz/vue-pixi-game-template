import assert from 'node:assert/strict'
import {
  createGame,
  getPlayerTrackCount,
  getWeightedDiceRoll,
  rollDice,
} from '../src/game/flight-ludo.ts'

assert.equal(getWeightedDiceRoll(0, 0.1), 6, 'no track pieces should favor 6')
assert.equal(getWeightedDiceRoll(0, 0.9), 5, 'no track pieces should still allow non-6 outcomes')
assert.equal(getWeightedDiceRoll(2, 0.1), 1, 'normal rolls should stay uniform when pieces are on track')

const state = createGame({ mode: 1, piecesPerPlayer: 2 })
assert.equal(getPlayerTrackCount(state.players[0]), 0, 'fresh game should start with no track pieces')

const originalRandom = Math.random
Math.random = () => 0.9
try {
  const result = rollDice(state)
  assert.equal(result.rolled, true)
  assert.equal(result.skipped, true, 'a non-6 launch roll with no movable pieces should be skipped')
  assert.equal(result.advancePending, false, 'the turn should advance immediately after a failed launch roll')
  assert.equal(state.currentPlayerIndex, 1, 'turn should advance to the next player')
  assert.equal(state.dice, null, 'the failed roll should clear when the next turn starts')
  assert.notEqual(result.message.includes('已轮到'), false, 'message should mention the next player')
} finally {
  Math.random = originalRandom
}

