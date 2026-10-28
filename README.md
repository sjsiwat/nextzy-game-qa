# nextzy-game-qa

A test plan, automated tests and bug reports for the **Nextzy points game**
([live](https://nextzy-game.vercel.app), [source](https://github.com/sjsiwat/nextzy-game)):
a small full-stack game where a server draws random scores, collects them towards
10,000 and unlocks three rewards.

I built the game as a bootcamp assignment, then tested it as if someone else had.
The point of this repository is the testing: what I planned to check and why,
how I checked it, and what I found.

## What is here

| | |
|---|---|
| [`docs/test-plan.md`](docs/test-plan.md) | Scope, approach, risks, coverage by requirement, results, what was not done |
| [`docs/bug-reports/`](docs/bug-reports) | Three bug reports (all fixed): steps, expected, actual, how often, impact, root cause, fix, verification |
| [`tests/api/`](tests/api) | 63 API tests with Node's built-in runner, no dependencies |
| [`tests/e2e/`](tests/e2e) | 16 end-to-end tests with Playwright on a mobile viewport |

## Result in one paragraph

79 automated tests, all passing. The first pass found **three defects**: a `500` when
two rounds hit a brand-new player at the same moment (Medium, measured: 30 of 30
trials), a claim endpoint that accepted `5e3` and `0x1388` as checkpoint 5000 (Low),
and a UUID that meant a different player in upper case (Low). The rules that matter
most had held from the start: rewards cannot be claimed twice, even with ten
simultaneous requests; the cap, reset and history limit behave as documented; the
screen agrees with the server. The three defects were then fixed in the game, and I
re-ran everything against the redeployed production: the same trial that failed 30 of
30 times now fails 0 of 30.

## Run it

Needs Node 22 or newer and Chrome.

```bash
npm install
npm run test:api
npm run test:e2e
```

Tests play as throwaway players (a UUID each) and reset them afterwards, so
nothing is left in the database. Point them at a local copy of the game with
`API_URL` and `WEB_URL`.

The API runs on a free plan that sleeps; the first request after a quiet spell
can take up to a minute, which the timeouts allow for.

## Layout

```
docs/
  test-plan.md
  bug-reports/BUG-00x-*.md
tests/
  api/        contract, play, checkpoints, history and reset, concurrency, input handling, CORS
  e2e/        Home and Game flows, error states, players, layout
  helpers/    API client and the throwaway-player pool
playwright.config.ts
```
