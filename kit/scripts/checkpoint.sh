#!/usr/bin/env bash
set -euo pipefail
A="${1:-${AGENT_ID:-}}"; [[ -n "$A" ]] || { echo "Usage: $0 agent" >&2; exit 2; }
: "${AGENT_COORD:?Export AGENT_COORD}"; : "${AGENT_REPO:?Export AGENT_REPO}"
python3 - "$AGENT_COORD/status/$A.json" "$A" "$AGENT_REPO" <<'PY'
import json,sys,subprocess
from pathlib import Path
from datetime import datetime,timezone
p,a,repo=sys.argv[1:]
def git(*args): return subprocess.check_output(["git","-C",repo,*args],text=True).strip()
path=Path(p); path.parent.mkdir(parents=True,exist_ok=True)
try: d=json.loads(path.read_text())
except Exception: d={}
d.update(agent=a,worktree=repo,branch=git("branch","--show-current"),head=git("rev-parse","HEAD"),git_status=git("status","--short"),last_checkpoint_utc=datetime.now(timezone.utc).isoformat())
path.write_text(json.dumps(d,indent=2)+"\n")
print(path)
PY
