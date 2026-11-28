#!/usr/bin/env python3
"""
Minimal GitHub API client for the ReKey mission.

Uses a token from a local file (never printed, never committed). Supports only
what the mission needs: download workflow artifacts, open PRs, create issues,
read run logs.

Usage:
  gh_api.py artifact <run_id> <artifact_id> <out_path>
  gh_api.py pr <head_branch> <base_branch> <title> <body_file>
  gh_api.py issue <title> <body_file>
  gh_api.py logs <run_id>
  gh_api.py run <run_id>
"""
import json
import os
import sys
import urllib.error
import urllib.request

TOKEN_PATHS = ["/tmp/ghtok_scoped", os.path.expanduser("~/.ghtoken")]
REPO = "NeonTechno/Solana-Recovers"
API = "https://api.github.com"


def token() -> str:
    for path in TOKEN_PATHS:
        if os.path.exists(path):
            value = open(path).read().strip()
            if value:
                return value
    raise SystemExit("No GitHub token found at %s" % ", ".join(TOKEN_PATHS))


def request(method, path, body=None, raw=False, accept="application/vnd.github+json"):
    url = path if path.startswith("http") else f"{API}{path}"
    data = None
    headers = {
        "Authorization": f"Bearer {token()}",
        "Accept": accept,
        "User-Agent": "rekey-lead",
    }
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            payload = response.read()
            if raw:
                return payload
            return json.loads(payload.decode() or "{}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode()[:600]
        raise SystemExit(f"HTTP {error.code} {path}: {detail}")


def cmd_artifact(run_id, artifact_id, out_path):
    payload = request(
        "GET",
        f"/repos/{REPO}/actions/artifacts/{artifact_id}/zip",
        raw=True,
        accept="application/vnd.github.v3+json",
    )
    with open(out_path, "wb") as handle:
        handle.write(payload)
    print(f"WROTE {out_path} ({len(payload)} bytes)")


def cmd_pr(head, base, title, body_file):
    body = open(body_file).read()
    existing = request("GET", f"/repos/{REPO}/pulls?state=all&per_page=100")
    for pr in existing:
        if pr["head"]["ref"] == head and pr["state"] == "open":
            print(f"EXISTS #{pr['number']} {pr['html_url']}")
            return
    result = request(
        "POST",
        f"/repos/{REPO}/pulls",
        {"title": title, "head": head, "base": base, "body": body},
    )
    print(f"PR #{result['number']} {result['html_url']}")


def cmd_issue(title, body_file):
    body = open(body_file).read()
    result = request("POST", f"/repos/{REPO}/issues", {"title": title, "body": body})
    print(f"ISSUE #{result['number']} {result['html_url']}")


def cmd_logs(run_id):
    payload = request(
        "GET",
        f"/repos/{REPO}/actions/runs/{run_id}/logs",
        raw=True,
        accept="application/vnd.github.v3+json",
    )
    with open(f"/tmp/ghlogs_{run_id}.zip", "wb") as handle:
        handle.write(payload)
    print(f"WROTE /tmp/ghlogs_{run_id}.zip ({len(payload)} bytes)")


def cmd_run(run_id):
    result = request("GET", f"/repos/{REPO}/actions/runs/{run_id}")
    print(f"{result['name']} {result['status']} {result.get('conclusion')}")
    jobs = request("GET", f"/repos/{REPO}/actions/runs/{run_id}/jobs")
    for job in jobs.get("jobs", []):
        print(f"  job {job['name']}: {job.get('conclusion')}")
        for step in job.get("steps", []):
            print(f"    - {step['name']}: {step.get('conclusion')}")


def cmd_artifacts(run_id):
    result = request("GET", f"/repos/{REPO}/actions/runs/{run_id}/artifacts")
    for artifact in result.get("artifacts", []):
        print(f"{artifact['id']} {artifact['name']} {artifact['size_in_bytes']} expired={artifact['expired']}")


if __name__ == "__main__":
    command = sys.argv[1]
    args = sys.argv[2:]
    if command == "artifact":
        cmd_artifact(args[0], args[1], args[2])
    elif command == "pr":
        cmd_pr(args[0], args[1], args[2], args[3])
    elif command == "issue":
        cmd_issue(args[0], args[1])
    elif command == "logs":
        cmd_logs(args[0])
    elif command == "run":
        cmd_run(args[0])
    elif command == "artifacts":
        cmd_artifacts(args[0])
    else:
        raise SystemExit(__doc__)
