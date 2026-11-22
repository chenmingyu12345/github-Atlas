"""Create or reuse the public GitHub issue for each skill's recommendation ballot."""

import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPO = "chenmingyu12345/github-Atlas"
LABEL = "skill-vote"
MARKER = re.compile(r"<!-- atlas-skill: (https://github\.com/[^\s]+) -->")


def github(*args, payload=None):
    return subprocess.check_output(
        ["gh", *args], input=None if payload is None else json.dumps(payload),
        cwd=ROOT, encoding="utf-8",
    )


def main():
    skills = json.loads(subprocess.check_output(
        ["node", "-e", "const vm=require('node:vm'),fs=require('node:fs');"
         "console.log(JSON.stringify(vm.runInNewContext(fs.readFileSync('docs/tools.js','utf8')"
         "+';resources.filter(r=>r.kind===\"skill\")')));"], cwd=ROOT, encoding="utf-8",
    ))
    github("label", "create", LABEL, "--force", "--color", "1A7F64",
           "--description", "效率工具图鉴的公开技能投票", "--repo", REPO)
    issues = json.loads(github("issue", "list", "--repo", REPO, "--label", LABEL,
                               "--state", "all", "--limit", "500", "--json", "number,body"))
    ballots = {}
    for issue in issues:
        match = MARKER.search(issue["body"])
        if match and match[1] in ballots:
            raise ValueError(f"Duplicate ballot for {match[1]}")
        if match:
            ballots[match[1]] = issue["number"]
    for skill in skills:
        url, name = skill["url"], skill["name"]
        if url in ballots:
            continue
        body = (
            f"这是效率工具图鉴中 **{name}** 的公开投票页。\n\n"
            f"[查看官方技能]({url}) · [回到图鉴](https://{REPO.split('/')[0]}.github.io/{REPO.split('/')[1]}/)\n\n"
            "使用本帖下方的表情反馈选择 👍 推荐 或 👎 不推荐。每个账号请选择一项，"
            "改票时先取消原来的表情。评论区也可说明适用场景。\n\n"
            f"<!-- atlas-skill: {url} -->"
        )
        result = json.loads(github("api", "--method", "POST", f"repos/{REPO}/issues",
                                   "--input", "-", payload={
                                       "title": f"技能投票 · {name}", "body": body, "labels": [LABEL],
                                   }))
        ballots[url] = result["number"]
        print(f"{result['number']} {name}", flush=True)
    active = {skill["url"]: ballots[skill["url"]] for skill in skills}
    (ROOT / "docs" / "ballots.js").write_text(
        "const skillBallots = " + json.dumps(active, indent=2) + ";\n", encoding="utf-8",
    )
    print(f"Synchronized {len(active)} skill ballots.")


if __name__ == "__main__":
    main()
