"""Refresh the published website's Star counts using the GitHub CLI."""

import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_repositories():
    script = (
        "const vm=require('node:vm'), fs=require('node:fs');"
        "console.log(JSON.stringify(vm.runInNewContext("
        "fs.readFileSync('docs/tools.js','utf8')+';resources.map(x=>x.repository).filter(Boolean)')));"
    )
    names = json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT))
    return sorted(set(names), key=str.casefold)


def get_star_counts(names):
    fields = []
    for i, slug in enumerate(names):
        owner, repository = slug.split("/")
        fields.append(
            f"repo{i}:repository(owner:{json.dumps(owner)},name:{json.dumps(repository)})"
            "{stargazerCount isPrivate}"
        )
    query = {"query": "query {" + " ".join(fields) + "}"}
    result = subprocess.run(
        ["gh", "api", "graphql", "--input", "-"],
        input=json.dumps(query), check=True, capture_output=True, encoding="utf-8",
    )
    data = json.loads(result.stdout)["data"]
    counts = {}
    for i, slug in enumerate(names):
        entry = data.get(f"repo{i}")
        if not entry or entry["isPrivate"]:
            raise ValueError(f"Public GitHub repository unavailable: {slug}")
        counts[slug] = entry["stargazerCount"]
    return counts


def main():
    names = read_repositories()
    counts = {}
    for start in range(0, len(names), 25):
        counts.update(get_star_counts(names[start:start + 25]))
    payload = {
        "date": datetime.now(timezone(timedelta(hours=8))).date().isoformat(),
        "counts": counts,
    }
    path = ROOT / "docs" / "stars.js"
    path.write_text("const starSnapshot = " + json.dumps(payload, indent=2) + ";\n", encoding="utf-8")
    print(f"Updated Star counts for {len(counts)} repositories")


if __name__ == "__main__":
    main()
