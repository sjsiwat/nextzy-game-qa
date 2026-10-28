# BUG-001: Two rounds sent at the same moment for a new player: one answers 500

| | |
|---|---|
| **Status** | **Fixed**, verified on production 2026-10-28 |
| **Fixed in** | [nextzy-game `86541505`](https://github.com/sjsiwat/nextzy-game/commit/86541505) |
| **Severity** | Medium (a valid request fails with a server error; no data is corrupted, a retry works) |
| **Priority** | Medium |
| **Component** | Backend, `POST /players/:playerId/game/play` |
| **Found** | 2026-10-28, exploratory testing, then confirmed by automated test `TC-API-052` |
| **Environment** | Production API `https://nextzy-game.onrender.com` |

## Summary

When two (or more) `play` requests for a player **who has never played** arrive at
the same time, one of them succeeds and the others answer
`500 Internal server error`. The same requests for a player who already exists
all succeed.

## Steps to reproduce

```bash
B=https://nextzy-game.onrender.com
P=$(uuidgen | tr A-Z a-z)               # a brand-new player
curl -s -X POST $B/players/$P/game/play & \
curl -s -X POST $B/players/$P/game/play & wait
```

Or run the automated check: `npm run test:api` (`TC-API-052`, listed as `todo`).

## Expected

Both requests answer `201` with `{ score, totalScore }`, and the player's total
is the sum of the two draws (OpenAPI: `POST .../game/play` answers 201 or 400).

## Actual

One request answers `201`; the other answers:

```json
{"statusCode":500,"message":["Internal server error"],"path":"/players/<id>/game/play","timestamp":"..."}
```

The total afterwards equals the successful draw only, so nothing is double
counted or lost; the failed round simply never happened.

## How often

Measured against production on 2026-10-28, each trial using a new player:

| Scenario | Trials with at least one 500 | Failed requests |
|---|---|---|
| New player, 2 parallel rounds | **30 / 30** | 30 / 60 |
| New player, 25 parallel rounds | 4 / 4 | 28 / 100 |
| Existing player, 2 parallel rounds | 0 / 30 | 0 / 60 |
| Existing player, 25 parallel rounds | 0 / 4 | 0 / 100 |

## Impact

- The web app disables the button while a round is in progress, so one browser
  tab cannot trigger it. Two tabs sharing the same `localStorage` id pressing
  "สุ่มคะแนน" together as a player's very first round, or any API client, can.
- The player gets a generic error message and has to press again. No lost points.

## Root cause (confirmed)

This started as a hypothesis, because production gives no access to server
logs. I then reproduced it against a local copy of the unmodified code (three
trials of two parallel rounds: `201` and `500` every time) and the server log
showed `Unique constraint failed on the constraint: Player_pkey`.

`GameService.play` ran `tx.player.upsert(...)` inside an interactive
transaction. Prisma's upsert checks, then inserts, so two transactions that both
find no row both try to insert it; the loser hits the primary-key constraint
(Prisma `P2002`). `AllExceptionsFilter` turns any non-HTTP error into a generic
500, which is why the cause was invisible to the client.

## Fix

The upsert was replaced by `createMany({ data: [{ id }], skipDuplicates: true })`,
which is a single `INSERT ... ON CONFLICT DO NOTHING`, so two simultaneous first
rounds no longer collide.

## Verification

After the fix was deployed, against production:

| Scenario | Before | After |
|---|---|---|
| New player, 2 parallel rounds | 30 / 30 trials had a 500 | **0 / 30** |
| New player, 25 parallel rounds | 28 of 100 requests failed | **0 of 100** |
| Existing player, 2 or 25 parallel rounds | 0 failures | 0 failures |

The test is no longer marked `todo` and passes (TC-API-052, plus a new burst-of-25 case).

## Evidence

`tests/api/05-concurrency.test.mjs` (TC-API-052) and the tables above.
