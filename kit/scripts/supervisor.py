#!/usr/bin/env python3
import json,sys,subprocess
from pathlib import Path
from datetime import datetime,timezone
coord=Path(sys.argv[1]); root=Path(sys.argv[2]); now=datetime.now(timezone.utc)
agents=["hermes","openclaude","junie","kimi","vibe"]
print("Solana Recovers agent supervisor |",now.isoformat())
all_handoffs=True
for a in agents:
 p=coord/"status"/(a+".json"); h=coord/"handoffs"/(a+".md"); w=root/a
 if p.exists():
  try:
   d=json.loads(p.read_text()); stamp=d.get("last_checkpoint_utc")
   age=(now-datetime.fromisoformat(stamp.replace("Z","+00:00"))).total_seconds()/60 if stamp else None
   flag="STALE" if age is None or age>15 else "OK"
   print(f"[{flag}] {a}: state={d.get('state','?')} checkpoint={int(age) if age is not None else 'unknown'}m task={d.get('current_task','-')}")
  except Exception as e: print(f"[WARN] {a}: invalid status: {e}")
 else: print(f"[MISSING] {a}: no status report")
 if not h.exists(): all_handoffs=False
 if w.exists():
  branch=subprocess.check_output(["git","-C",str(w),"branch","--show-current"],text=True).strip()
  dirty=subprocess.check_output(["git","-C",str(w),"status","--short"],text=True).strip()
  print(f"       branch={branch} dirty={'yes' if dirty else 'no'}")
 else: print("       worktree missing")
print("Handoffs:", "7/7 files exist; inspect content/diffs/tests" if all_handoffs else "not all present")
print("Advisory only: does not validate claims, merge, push or deploy.")
