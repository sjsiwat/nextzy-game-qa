# BUG-003: The same UUID in upper case is a different player

| | |
|---|---|
| **Status** | **Fixed**, verified on production 2026-10-28 |
| **Fixed in** | [nextzy-game `d4fcd436`](https://github.com/sjsiwat/nextzy-game/commit/d4fcd436) |
| **Severity** | Low |
| **Priority** | Low |
| **Component** | Backend, player identity (all `/players/:playerId/...` endpoints) |
| **Found** | 2026-10-28, exploratory testing; automated as `TC-API-062` |
| **Environment** | Production API `https://nextzy-game.onrender.com` |

## Summary

UUIDs are case-insensitive (RFC 4122 asks consumers to accept either case), and
the API accepts upper-case UUIDs as valid input. But it stores the id as plain
text, so `ABCD...` and `abcd...` are two separate players with separate scores
and histories.

## Steps to reproduce

```bash
B=https://nextzy-game.onrender.com
P=$(uuidgen | tr A-Z a-z)
curl -s -X POST $B/players/$P/game/play                       # lower case: { "score": 300, "totalScore": 300 }
curl -s $B/players/$(echo $P | tr a-z A-Z)/summary           # upper case of the same id
```

## Expected

The upper-case request reads the same player: `totalScore` 300 (or a `400` if
only lower case is meant to be accepted).

## Actual

`totalScore` is `0`. Playing under the upper-case spelling then creates a second
player; afterwards the two spellings report different totals (observed 300 and 3000).

## Impact

Low for the shipped web app, which always generates lower-case ids with
`crypto.randomUUID()`. It matters for API clients and for anyone testing by hand
who pastes an id in another case: progress appears to vanish.

## Fix

`PlayerParamsDto` now lower-cases the id before it is used, so any spelling of a
UUID is the same player. (Storing the column as the database `uuid` type would also
work, but needs a migration.)

## Verification

After the fix was deployed, reading a lowercase player through the uppercase
spelling returns the same total on production (TC-API-062, no longer `todo`).
One consequence: a player created earlier under an upper-case id would no longer be
found. Only my own test players were affected, and they had been reset.

## Evidence

`tests/api/06-input-handling.test.mjs` (TC-API-062).
