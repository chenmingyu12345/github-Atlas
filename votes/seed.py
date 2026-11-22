"""Print SQL to initialize ballots with existing GitHub votes."""

import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    source = (ROOT / "docs" / "ballots.js").read_text(encoding="utf-8")
    ballots = set(json.loads(source.removeprefix("const skillBallots = ").strip().removesuffix(";")).values())
    output = subprocess.check_output([
        "gh", "api", "--paginate", "--slurp",
        "repos/chenmingyu12345/github-Atlas/issues?labels=skill-vote&state=all&per_page=100",
    ], encoding="utf-8", cwd=ROOT)
    issues = {issue["number"]: issue["reactions"] for page in json.loads(output) for issue in page}
    for ballot in sorted(ballots):
        assert isinstance(ballot, int) and ballot > 0
        recommend, not_recommend = (issues[ballot][choice] for choice in ("+1", "-1"))
        assert all(isinstance(count, int) and count >= 0 for count in (recommend, not_recommend))
        print("INSERT INTO ballots (id, legacy_recommend, legacy_not_recommend) "
              f"VALUES ({ballot}, {recommend}, {not_recommend}) ON CONFLICT (id) DO NOTHING;")


if __name__ == "__main__":
    main()
