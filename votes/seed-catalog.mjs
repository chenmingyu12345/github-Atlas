import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read = name => readFileSync(new URL(`../docs/${name}`, import.meta.url), "utf8");
const data = runInNewContext(
  ["tools.js", "ballots.js", "stars.js"].map(read).join("\n") +
  "\n;({resources, skillBallots, starSnapshot});",
);
const sqlValue = value => value == null ? "NULL" : typeof value === "number" ? String(value)
  : "'" + value.replaceAll("'", "''") + "'";

for (const [index, row] of data.resources.entries()) {
  const values = [
    `seed-${index + 1}`, row.name, row.name, row.kind, row.task, JSON.stringify(row.audiences),
    row.description, row.url, row.keywords, row.repository,
    data.starSnapshot.counts[row.repository], data.skillBallots[row.url], index,
  ];
  console.log(`INSERT INTO resources (id,bookmark_key,name,kind,task,audiences,description,url,keywords,repository,stars,ballot_id,position)
VALUES (${values.map(sqlValue).join(",")}) ON CONFLICT (id) DO NOTHING;`);
}
