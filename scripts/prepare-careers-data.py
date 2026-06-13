#!/usr/bin/env python3
"""Convert careers export for HuckHub: profiles.parquet -> profiles.json, teams.json from ExpertScraper SQLite."""

from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CAREERS_DIR = ROOT / "data" / "careers"
EXPERTSCRAPER_DB = Path("/Users/noahnicol/Desktop/ExpertScraper/data/expertscraper.sqlite")


def main() -> None:
    parquet_path = CAREERS_DIR / "profiles.parquet"
    if not parquet_path.exists():
        raise SystemExit(f"Missing {parquet_path}. Copy ExpertScraper export first.")

    df = pd.read_parquet(parquet_path)
    records = json.loads(df.to_json(orient="records"))
    for row in records:
        locs = row.get("known_locations")
        if locs is None or (isinstance(locs, float) and pd.isna(locs)):
            row["known_locations"] = []
        elif not isinstance(locs, list):
            row["known_locations"] = list(locs)

    profiles_json = CAREERS_DIR / "profiles.json"
    profiles_json.write_text(json.dumps(records, separators=(",", ":")))
    print(f"Wrote {len(records)} profiles to {profiles_json}")

    uids = {r["player_uid"] for r in records}
    teams_by_uid: dict[str, list[dict]] = defaultdict(list)

    if EXPERTSCRAPER_DB.exists():
        conn = sqlite3.connect(EXPERTSCRAPER_DB)
        conn.row_factory = sqlite3.Row
        placeholders = ",".join("?" * len(uids))
        rows = conn.execute(
            f"""
            SELECT player_uid, team_name, year, competition_level, division_name, team_location
            FROM player_team_context
            WHERE player_uid IN ({placeholders})
            ORDER BY player_uid, year DESC, team_name
            """,
            list(uids),
        ).fetchall()
        conn.close()

        seen: set[tuple] = set()
        for row in rows:
            uid = row["player_uid"]
            key = (uid, row["team_name"], row["year"])
            if key in seen:
                continue
            seen.add(key)
            teams_by_uid[uid].append(
                {
                    "team_name": row["team_name"],
                    "year": row["year"],
                    "competition_level": row["competition_level"],
                    "division_name": row["division_name"],
                    "team_location": row["team_location"],
                }
            )
        print(f"Exported teams for {len(teams_by_uid)} players from SQLite")
    else:
        print(f"Warning: {EXPERTSCRAPER_DB} not found; teams.json will be empty")

    teams_json = CAREERS_DIR / "teams.json"
    teams_json.write_text(json.dumps(dict(teams_by_uid), indent=2))
    print(f"Wrote {teams_json}")


if __name__ == "__main__":
    main()
