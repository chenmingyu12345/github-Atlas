const totalsSql = `
  SELECT b.id,
         b.legacy_recommend + COUNT(CASE WHEN v.choice = 1 THEN 1 END) AS recommend,
         b.legacy_not_recommend + COUNT(CASE WHEN v.choice = -1 THEN 1 END) AS notRecommend,
         MAX(CASE WHEN v.voter = ? THEN v.choice ELSE NULL END) AS choice
  FROM ballots b LEFT JOIN votes v ON v.ballot_id = b.id
`;
const voterPattern = /^[0-9a-f-]{36}$/i;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = {
      "Cache-Control": "no-store",
      "Vary": "Origin",
      "Access-Control-Allow-Origin": env.ATLAS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };
    const respond = (value, status = 200) => Response.json(value, {status, headers});
    if (origin && origin !== env.ATLAS_ORIGIN) return respond({error: "Origin not allowed"}, 403);
    const path = new URL(request.url).pathname;
    if (path !== "/votes") return respond({error: "Not found"}, 404);
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers});

    try {
      const authorization = request.headers.get("Authorization") || "";
      const voter = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (voter && !voterPattern.test(voter)) return respond({error: "Invalid voter"}, 400);
      if (request.method === "GET") {
        const rows = await env.DB.prepare(totalsSql + " GROUP BY b.id").bind(voter).all();
        return respond(rows.results);
      }
      if (request.method !== "PUT") return respond({error: "Method not allowed"}, 405);
      if (!voter) return respond({error: "Voter is required"}, 400);

      const raw = await request.text();
      if (raw.length > 128) return respond({error: "Invalid vote"}, 400);
      let vote;
      try { vote = JSON.parse(raw); } catch { return respond({error: "Invalid vote"}, 400); }
      const {id, choice} = vote ?? {};
      if (!Number.isSafeInteger(id) || id < 1 || ![1, -1].includes(choice)) {
        return respond({error: "Invalid vote"}, 400);
      }

      const [, updated] = await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO votes (ballot_id, voter, choice)
          SELECT id, ?, ? FROM ballots WHERE id = ?
          ON CONFLICT (ballot_id, voter) DO UPDATE SET choice = excluded.choice
        `).bind(voter, choice, id),
        env.DB.prepare(totalsSql + " WHERE b.id = ? GROUP BY b.id").bind(voter, id),
      ]);
      return updated.results.length ? respond(updated.results[0]) : respond({error: "Ballot not found"}, 404);
    } catch (error) {
      console.error("Vote request failed", error.message);
      return respond({error: "Voting unavailable"}, 503);
    }
  },
};
