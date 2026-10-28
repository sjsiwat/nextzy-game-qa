# Test plan: Nextzy points game

| | |
|---|---|
| **Product** | A points-collecting game: draw a random score, collect it towards 10,000, claim rewards at 5,000 / 7,500 / 10,000 |
| **Under test** | Web app `https://nextzy-game.vercel.app` (Next.js) and API `https://nextzy-game.onrender.com` (NestJS + PostgreSQL) |
| **Sources of truth** | The project README (rules and design decisions) and `docs/openapi.yaml` (the API contract) |
| **Author / date** | Siwat Jankam, 2026-10-28 |
| **Status** | Executed 2026-10-28; three defects found and fixed the same day; results in section 8 |

## 1. Goal

Find out whether the game behaves the way its README and API contract say it
does, especially where a wrong answer costs the player something: score,
rewards, and trust in the numbers on screen. Report what is wrong in a form a
developer can act on, and leave behind tests that can be re-run.

## 2. Scope

**In scope**

- Every API endpoint: health, summary, play, claim, reset, play history, reward history.
- The two web pages (Home, Game): rendering, the round animation, the result dialog, claiming, RESET, history tabs, error and empty states.
- Rules: the draw set, the 10,000 cap, claim-once, reset semantics, the 100-row history limit.
- Concurrency on play and claim.
- Input handling of path parameters.
- Layout across the supported width range (300 to 500 px).
- CORS for the web origin.

**Out of scope** (and why)

- Load and performance testing: the API is on a free plan that sleeps, and hammering a public demo is not appropriate.
- Security testing beyond input handling: the design has no login by intent (README), so access control is an accepted risk, listed in section 7.
- Browsers other than Chrome, and real devices: not available for this pass.
- The statistical fairness of the draw beyond "all four values appear and nothing else does".

## 3. Approach

| Level | Tool | What it covers |
|---|---|---|
| API, automated | Node's built-in test runner, no dependencies | Contract, rules, state transitions, concurrency, input handling (`tests/api`) |
| UI, automated | Playwright on installed Chrome, mobile viewport | User flows and states on both pages (`tests/e2e`) |
| Exploratory, manual | curl and small scripts | Hunting for behaviour the spec does not mention; findings became tests and bug reports |

Techniques used: equivalence partitioning and boundary values (scores around
the checkpoints and the cap), state-transition testing (locked, claimable,
claimed), error guessing (odd spellings of ids and checkpoints), and
concurrency probing.

**Test data.** A player is just a UUID, so every test creates its own
throwaway player, prepares state through the API (for example "play until
5,000"), and resets the player when it finishes. Nothing is shared between
tests and nothing is left behind in the database.

**Open defects stay visible, not hidden.** While a defect was open, its test was
marked `todo` (Node) with the bug id: it still ran and still failed, which was the
evidence, but it did not turn the suite red. All three defects have since been
fixed, their tests pass, and the markers are gone.

## 4. Environments

Production only: web on Vercel, API on Render (free plan, sleeps after about 15
minutes idle; the first request can take 30 to 60 seconds), database on
Supabase PostgreSQL. Both base URLs can be overridden with `API_URL` and `WEB_URL`
to point at a local run.

## 5. Entry and exit criteria

- **Entry:** both URLs answer; `GET /health` returns `{"status":"ok"}`.
- **Exit:** every case below has been executed; every failure is either fixed or
  recorded as a bug report with severity and evidence; no open defect of severity
  High or above.

## 6. Coverage: requirement to test

| Requirement (README / OpenAPI) | Cases |
|---|---|
| Health check returns 200 | TC-API-001 |
| One error shape for every failure; `message` is always an array | TC-API-002, 003 |
| `playerId` must be a UUID | TC-API-002, 004; BUG-003 (TC-API-062) |
| A round draws one of 300, 500, 1000, 3000 on the server | TC-API-010, 014; E2E-002 |
| The total accumulates and is capped at 10,000 | TC-API-011, 012; E2E-011 |
| Every round is written to the history, newest first | TC-API-013; E2E-004 |
| History is limited to the latest 100 | TC-API-030 |
| An unknown player reads as 0 and nothing is written | TC-API-015, 031; E2E-001 |
| Checkpoints: locked, claimable, claimed, with names A / B / C | TC-API-020, 026; E2E-005 |
| Claiming before reaching the score is 400 | TC-API-021 |
| An unknown checkpoint is 400 | TC-API-022; BUG-002 (TC-API-060) |
| A reward can be claimed once; the second claim is 409 | TC-API-024, 027, 061; E2E-014 |
| All three rewards claimable at the maximum, history newest first | TC-API-025, 032 |
| Reset deletes score, plays and rewards; idempotent; only that player | TC-API-040, 041, 042; E2E-006 |
| Parallel rounds do not lose points | TC-API-050, 051; BUG-001 (TC-API-052) |
| Only the web origin may call the API from a browser | TC-API-070 |
| Home and Game states: empty, loading, error with retry | E2E-001, 007, 008 |
| The round animation locks the button and ends in a dialog | E2E-002, 003, 009 |
| Player identity is kept across reloads and separate between profiles | E2E-012 |
| Layout works from 300 to 500 px | E2E-013 |
| Leaving mid-round does not desynchronise Home and the server | E2E-010 |

## 7. Risks considered

| Risk | Likelihood | Impact | How it was addressed |
|---|---|---|---|
| Lost or doubled points under concurrent requests | Medium | High | TC-API-050, 051, 052 (found BUG-001) |
| A reward claimed twice | Medium | High | TC-API-024, 027, 061, E2E-014 (holds) |
| The screen disagrees with the server | Low | High | The UI tests read the server's history and compare (E2E-002, 004, 010) |
| Loose input handling lets odd requests through | Medium | Low | TC-API-004, 022, 060 (found BUG-002, BUG-003) |
| Cold start of the API looks like a broken site | High | Medium | The unreachable-server message and retry are tested (E2E-007, 008); timeouts are generous |
| Anyone who knows an id can read, play or reset that player | High | Low | Accepted by design (README: no login). Not a defect; noted here |

## 8. Results

Both runs are against production, on 2026-10-28.

| Run | Suite | Tests | Passed | Known-defect failures | Unexpected failures |
|---|---|---|---|---|---|
| 1. First pass | API (`npm run test:api`) | 62 | 53 | 9, covering 3 bugs | 0 |
| | UI (`npm run test:e2e`) | 16 | 16 | 0 | 0 |
| 2. After the fixes were deployed | API | 63 | 63 | 0 | 0 |
| | UI | 16 | 16 | 0 | 0 |

The API count went from 62 to 63 because I added a burst-of-25 case for a brand-new
player, and one existing test changed on purpose (TC-API-061, below).

Bugs:

| Id | Severity | Title | Status |
|---|---|---|---|
| [BUG-001](bug-reports/BUG-001-parallel-first-plays-return-500.md) | Medium | Two rounds at the same moment for a new player: one answers 500 | Fixed (`86541505`) |
| [BUG-002](bug-reports/BUG-002-claim-accepts-non-integer-checkpoint-spellings.md) | Low | Claim endpoint accepts spellings of the checkpoint that are not integers | Fixed (`e33c10d9`) |
| [BUG-003](bug-reports/BUG-003-uuid-is-case-sensitive.md) | Low | The same UUID in upper case is a different player | Fixed (`d4fcd436`) |

The fix cycle: I reported the three defects, the fixes were made in the game's
repository (each with unit tests that fail on the old code), and I re-ran the whole
suite against the redeployed production. All nine tests that had been waiting on
the defects passed. TC-API-061 ("a loose spelling cannot be used to claim twice")
had asserted the old behaviour, a 409 for `5e3`; it now asserts the correct 400, a
test changing because the product changed, not to make it pass.

Worth saying plainly: the rules that matter most held up. Claim-once survived
ten simultaneous claims and loose spellings of the checkpoint; parallel rounds
for an existing player never lost a point (15 trials of two at once, plus a burst of 25); the cap, reset and
history limit all behaved as documented.

One of the first UI runs failed two tests. That was a mistake in the tests (the
framework adds its own `role="alert"` element, so my locator matched two
elements), not a defect in the game, and it was fixed in the test.

## 9. Observations (not defects)

| Id | Observation | Suggestion |
|---|---|---|
| OBS-01 | RESET deletes the player's score and history immediately, with no confirmation (E2E-006). The README explains it exists for testers. | If it ever ships to real players, add a confirm step. |
| OBS-02 | `GET` on a POST-only path such as `/players/:id/game/play` answers 404 "Cannot GET", not 405. | Cosmetic. |
| OBS-03 | Touch targets measured at a 430 px viewport: reward button 77 x 20 px, dialog close icon 18 x 18 px, RESET 85 x 27 px, history tabs 90 x 32 px. The main "go play" link is 398 x 48 px. WCAG 2.2 SC 2.5.8 asks for 24 x 24 px, with an exception for well-spaced targets; the common mobile guideline is 44 px. | Enlarge the reward button and the close icon. |
| OBS-04 | No rate limiting, and no authentication: anyone who knows an id can play or reset that player. The nil UUID `0000...` is accepted and is effectively a player shared by everyone who tries it. | Accepted by design. Worth revisiting before real use. |
| OBS-05 | The CORS preflight advertises `PUT, PATCH, DELETE` although no such routes exist. | Harmless; tighten if desired. |
| OBS-06 | At the cap the play history records the drawn score (for example 3,000) while the total stays at 10,000, so the history can add up to more than the total. | Documented in the README as intended; consider a note in the UI. |

## 10. Not done, and what that means

- Everything ran against production, so a defect that depends on a different
  environment (local, staging) would not show up here.
- BUG-001's cause could not be read from production logs. I confirmed it by
  reproducing the bug against a local copy of the original code and reading its
  log (`Unique constraint failed on the constraint: Player_pkey`). BUG-002 and
  BUG-003 were confirmed by the fixes and by unit tests that fail on the old code.
- Only Chrome was used. Safari and Firefox behaviour of the `<dialog>` element and the
  layout is untested.
- No accessibility audit beyond role-based locators and the target sizes in OBS-03.

## 11. How to run

```bash
npm install
npm run test:api        # no browser needed, about 25 seconds
npm run test:e2e        # uses the Chrome installed on the machine, about 40 seconds
npm test                # both
API_URL=http://localhost:3001 WEB_URL=http://localhost:3000 npm test   # against a local run
```

The first request after a quiet spell can be slow because the API sleeps.
