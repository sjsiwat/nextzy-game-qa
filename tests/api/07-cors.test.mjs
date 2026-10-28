// Browser access: the web app's origin is allowed, others are not.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { API_URL, WEB_URL } from "../helpers/api.mjs";

const PLAYER = "11111111-1111-4111-8111-111111111111";

describe("TC-API-070 CORS", () => {
  it("echoes the web app's origin", async () => {
    const res = await fetch(`${API_URL}/players/${PLAYER}/summary`, { headers: { Origin: WEB_URL } });
    assert.equal(res.headers.get("access-control-allow-origin"), WEB_URL);
  });

  it("does not grant another origin", async () => {
    const res = await fetch(`${API_URL}/players/${PLAYER}/summary`, { headers: { Origin: "https://evil.example" } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });

  it("answers the preflight for POST from the web app's origin", async () => {
    const res = await fetch(`${API_URL}/players/${PLAYER}/game/play`, {
      method: "OPTIONS",
      headers: { Origin: WEB_URL, "Access-Control-Request-Method": "POST" },
    });
    assert.equal(res.status, 204);
    assert.match(res.headers.get("access-control-allow-methods") ?? "", /POST/);
  });
});
