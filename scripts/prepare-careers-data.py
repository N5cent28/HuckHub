#!/usr/bin/env python3
"""Convert careers export for HuckHub: profiles.parquet -> profiles.json, teams.json from ExpertScraper SQLite."""

from __future__ import annotations

import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

import pandas as pd


def normalize_location(loc: str) -> str:
    loc = re.sub(r"\s+", " ", loc.strip())
    return re.sub(r"\s*,\s*", ", ", loc)

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
        seen: set[str] = set()
        normalized: list[str] = []
        for loc in row["known_locations"]:
            if not isinstance(loc, str):
                continue
            n = normalize_location(loc)
            if not n:
                continue
            key = n.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(n)
        row["known_locations"] = normalized

    profiles_json = CAREERS_DIR / "profiles.json"
    profiles_json.write_text(json.dumps(records, separators=(",", ":")))
    print(f"Wrote {len(records)} profiles to {profiles_json}")

    uids = {r["player_uid"] for r in records}
    teams_by_uid: dict[str, list[dict]] = defaultdict(list)
    sqlite_teams: dict[str, list[dict]] = defaultdict(list)

    if EXPERTSCRAPER_DB.exists():
        conn = sqlite3.connect(EXPERTSCRAPER_DB)
        conn.row_factory = sqlite3.Row
        placeholders = ",".join("?" * len(uids))
        rows = conn.execute(
            f"""
            SELECT player_uid, team_name, year, competition_level, division_name, team_location, team_role
            FROM player_team_context
            WHERE player_uid IN ({placeholders})
            ORDER BY player_uid, year DESC, team_name
            """,
            list(uids),
        ).fetchall()
        conn.close()

        seen_sqlite: set[tuple] = set()
        for row in rows:
            uid = row["player_uid"]
            key = (uid, row["team_name"], row["year"])
            if key in seen_sqlite:
                continue
            seen_sqlite.add(key)
            entry = {
                "team_name": row["team_name"],
                "year": row["year"],
                "competition_level": row["competition_level"],
                "division_name": row["division_name"],
                "team_location": row["team_location"],
                "role": row["team_role"] if row["team_role"] == "coach" else "player",
            }
            sqlite_teams[uid].append(entry)
        print(f"Loaded SQLite teams for {len(sqlite_teams)} players")
    else:
        print(f"Warning: {EXPERTSCRAPER_DB} not found; division enrichment may be limited")

    def enrich_team(raw: dict, role: str, uid: str) -> dict:
        match = next(
            (
                t
                for t in sqlite_teams.get(uid, [])
                if t["team_name"] == raw.get("team_name") and t["year"] == raw.get("year")
            ),
            None,
        )
        loc = raw.get("location") or raw.get("team_location") or (match or {}).get("team_location")
        return {
            "team_name": raw["team_name"],
            "year": raw["year"],
            "competition_level": raw.get("competition_level") or (match or {}).get("competition_level"),
            "division_name": (match or {}).get("division_name"),
            "team_location": loc,
            "role": role,
        }

    for row in records:
        uid = row["player_uid"]
        playing = row.get("playing_teams") or []
        coached = row.get("coached_teams") or []
        if playing or coached:
            seen: set[tuple] = set()
            for t in playing:
                key = (t["team_name"], t["year"], "player")
                if key in seen:
                    continue
                seen.add(key)
                teams_by_uid[uid].append(enrich_team(t, "player", uid))
            for t in coached:
                key = (t["team_name"], t["year"], "coach")
                if key in seen:
                    continue
                seen.add(key)
                teams_by_uid[uid].append(enrich_team(t, "coach", uid))
        elif uid in sqlite_teams:
            for t in sqlite_teams[uid]:
                teams_by_uid[uid].append({**t, "role": "player"})

    if teams_by_uid:
        print(f"Exported teams for {len(teams_by_uid)} players")

    teams_json = CAREERS_DIR / "teams.json"
    teams_json.write_text(json.dumps(dict(teams_by_uid), indent=2))
    print(f"Wrote {teams_json}")


if __name__ == "__main__":
    main()
