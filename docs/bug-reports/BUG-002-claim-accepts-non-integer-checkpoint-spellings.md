# BUG-002: Claim endpoint accepts spellings of the checkpoint that are not integers

| | |
|---|---|
| **Status** | Open |
| **Severity** | Low (input validation is looser than the contract; no data is corrupted) |
| **Priority** | Low |
| **Component** | Backend, `POST /players/:playerId/rewards/:checkpoint/claim` |
| **Found** | 2026-10-28, exploratory testing; automated as `TC-API-060` |
| **Environment** | Production API `https://nextzy-game.onrender.com` |

## Summary

The OpenAPI document defines `checkpoint` as an **integer** from the set
`5000 / 7500 / 10000`. The endpoint converts the path segment with `Number()`
before checking it, so several other spellings of 5000 claim checkpoint 5000
and answer `201`.

## Steps to reproduce

For a player whose total has reached 5,000, call the claim endpoint with any of:

| Path segment | Actual | Expected |
|---|---|---|
| `5000.0` | 201 | 400 |
| `5e3` | 201 | 400 |
| `0x1388` | 201 | 400 |
| `+5000` | 201 | 400 |
| `05000` | 201 | 400 |
| `%205000` (leading space) | 201 | 400 |
| `5000%20` (trailing space) | 201 | 400 |

Rejected correctly (400): `5000abc`, `-5000`, `abc`, `2500`, `5001`.

```bash
B=https://nextzy-game.onrender.com
curl -i -X POST "$B/players/<id with 5000+ points>/rewards/5e3/claim"
```

## Expected

`400 Bad Request` with `checkpoint must be one of the following values: 5000, 7500, 10000`.

## Actual

`201 Created` and the reward for checkpoint 5000 is recorded.

## Impact

Low. The stored value is always the canonical `5000`, and a second claim through
any spelling is correctly refused with `409` (`TC-API-061` passes), so the
"claim once" guarantee holds. The risk is a looser contract than documented,
which can mask client bugs and confuse caching or logging keyed on the URL.

## Analysis (hypothesis)

`ClaimParamsDto` uses `@Type(() => Number)` and then `@IsIn(CHECKPOINT_POINTS)`.
`Number("5e3")`, `Number("0x1388")`, `Number(" 5000")` and so on all equal 5000,
so the `IsIn` check passes.

## Suggested fix

Validate the raw string first, for example `@Matches(/^(5000|7500|10000)$/)` or
`@IsIn(["5000","7500","10000"])` before transforming.

## Evidence

`tests/api/06-input-handling.test.mjs` (TC-API-060, seven cases).
