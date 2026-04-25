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
  assert.equal(result.advancePending, false, 'a failed launch roll should not auto-advance away from the player')
  assert.equal(state.currentPlayerIndex, 0, 'player should keep the turn when no pieces can move')
  assert.equal(state.dice, null, 'failed launch roll should clear the dice so the same player can try again')
} finally {
  Math.random = originalRandom
}

