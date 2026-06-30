#!/usr/bin/env python3
"""
Rebuild playing_teams / coached_teams in profiles.json and teams.json from
ExpertScraper SQLite team_role (player vs coach).

Run after copying a careers export when coached_teams looks sparse or stale:

  python3 scripts/sync-careers-team-roles.py

Requires expertscraper.sqlite at the default ExpertScraper path (override with
EXPERTSCRAPER_DB env var).
"""

from __future__ import annotations

import json
import os
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAREERS_DIR = ROOT / "data" / "careers"
DEFAULT_DB = Path("/Users/noahnicol/Desktop/ExpertScraper/data/expertscraper.sqlite")


def team_row(
    team_name: str,
    year: int,
    competition_level: str | None,
    division_name: str | None,
    team_location: str | None,
    team_role: str | None,
) -> tuple[dict, str]:
    role = "coach" if (team_role or "player") == "coach" else "player"
    profile_entry = {
        "team_name": team_name,
        "year": year,
        "competition_level": competition_level,
        "location": team_location,
    }
    teams_entry = {
        "team_name": team_name,
        "year": year,
        "competition_level": competition_level,
        "division_name": division_name,
        "team_location": team_location,
        "role": role,
    }
    return profile_entry, teams_entry


def affiliations_for_uid(conn: sqlite3.Connection, player_uid: str) -> dict:
    rows = conn.execute(
        """
        SELECT team_name, year, team_role, competition_level, division_name, team_location
        FROM player_team_context
        WHERE player_uid = ?
        ORDER BY year DESC, team_name
        """,
        (player_uid,),
    ).fetchall()

    playing: list[dict] = []
    coached: list[dict] = []
    teams_json: list[dict] = []
    seen: set[tuple] = set()

    for team_name, year, team_role, competition_level, division_name, team_location in rows:
        key = (team_name, year, team_role or "player")
        if key in seen:
            continue
        seen.add(key)
        profile_entry, teams_entry = team_row(
            team_name, year, competition_level, division_name, team_location, team_role
        )
        teams_json.append(teams_entry)
        if (team_role or "player") == "coach":
            coached.append(profile_entry)
        else:
            playing.append(profile_entry)

    return {
        "playing_teams": playing,
        "coached_teams": coached,
        "teams_json": teams_json,
    }


def main() -> None:
    profiles_path = CAREERS_DIR / "profiles.json"
    teams_path = CAREERS_DIR / "teams.json"
    db_path = Path(os.environ.get("EXPERTSCRAPER_DB", str(DEFAULT_DB)))

    if not profiles_path.exists():
        raise SystemExit(f"Missing {profiles_path}")
    if not db_path.exists():
        raise SystemExit(f"Missing ExpertScraper DB: {db_path}")

    profiles = json.loads(profiles_path.read_text())
    uids = {p["player_uid"] for p in profiles}

    conn = sqlite3.connect(db_path)
    teams_by_uid: dict[str, list[dict]] = defaultdict(list)

    updated = 0
    with_coached = 0
    coach_rows = 0

    uid_placeholders = ",".join("?" * len(uids))
    # preload counts for logging
    coach_player_count = conn.execute(
        f"""
        SELECT COUNT(DISTINCT player_uid)
        FROM player_team_context
        WHERE player_uid IN ({uid_placeholders}) AND team_role = 'coach'
        """,
        list(uids),
    ).fetchone()[0]

    for profile in profiles:
        uid = profile["player_uid"]
        aff = affiliations_for_uid(conn, uid)
        profile["playing_teams"] = aff["playing_teams"]
        profile["coached_teams"] = aff["coached_teams"]
        teams_by_uid[uid] = aff["teams_json"]
        updated += 1
        if aff["coached_teams"]:
            with_coached += 1
            coach_rows += len(aff["coached_teams"])

    conn.close()

    profiles_path.write_text(json.dumps(profiles, separators=(",", ":")))
    teams_path.write_text(json.dumps(dict(teams_by_uid), indent=2))

    print(f"Updated {updated} profiles in {profiles_path}")
    print(f"Profiles with coached_teams: {with_coached} ({coach_rows} coach rows)")
    print(f"Distinct players with coach role in SQLite (careers uids): {coach_player_count}")
    print(f"Wrote {teams_path}")


if __name__ == "__main__":
    main()
