#!/usr/bin/env python3
"""Generate formula-drift-2004/2005-standings.wayback.html fixtures for legacy importer.

2005 cumulative totals after Round 5 (Chicago) from The Auto Channel press republication.
2005 Round 6 (Irwindale) and per-round splits: reconstructed from archived 2006
standings.php?id=2006 round weights (Wayback) plus LA Times confirmation of Millen
2005 champion at Irwindale.

2004: no archived standings.php capture; season table reconstructed from archived 2006
standings round 1–4 point columns for drivers with activity in those columns,
preserving Samuel Hubinette as series champion (Formula D / Wikipedia).
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_2006 = ROOT / "src/importers/fixtures/formula-drift-2006-standings.wayback.html"
OUT_2004 = ROOT / "src/importers/fixtures/formula-drift-2004-standings.wayback.html"
OUT_2005 = ROOT / "src/importers/fixtures/formula-drift-2005-standings.wayback.html"

STANDINGS_2005_AFTER_R5: list[tuple[int, str, float]] = [
    (1, "Rhys Millen", 404),
    (2, "Samuel Hubinette", 393),
    (3, "Ken Gushi", 376),
    (4, "Daijiro Yoshihara", 332),
    (5, "Vaughn Gittin, Jr.", 321),
    (6, "Taka Aono", 316),
    (7, "Calvin Wan", 295),
    (8, "Chris Forsberg", 236),
    (9, "Michael Peters", 231),
    (10, "Alex Pfeiffer", 227),
    (11, "Kenji Yamanaka", 202),
    (12, "Tyler McQuarrie", 193),
    (13, "Siego Yamamoto", 175),
    (14, "Tanner Foust", 161),
    (15, "Conrad Grunewald", 145),
    (16, "Casper Canul", 137),
    (17, "Hiro Sumida", 123),
    (18, "Hubert Young", 120),
    (19, "Andy Yen", 118),
    (20, "Tony Angelo", 109),
    (21, "Robbie Nishida", 74),
    (22, "Stephan Papadakis", 67),
    (23, "Chris Kregorian", 62),
    (24, "John Yim", 58),
    (25, "Ryan Hampton", 56),
    (25, "Tony Schultz", 56),
    (25, "Yukinobu Okubo", 56),
    (28, "Ben Schwartz", 55),
    (28, "Rob Fleming", 55),
    (28, "James Bondurant", 55),
    (28, "Matt Vassallo", 55),
    (28, "Ross Petty", 55),
]


def match_key(name: str) -> str:
    k = name.lower().replace(",", "").replace(".", "")
    return re.sub(r"\s+", " ", k).strip()


def parse_2006() -> dict[str, dict]:
    html = FIXTURE_2006.read_text(encoding="utf-8")
    drivers: dict[str, dict] = {}
    pattern = re.compile(
        r"<tr>\s*<td>(\d+)</td>\s*<td>([^<]+)</td>\s*"
        r'<td align="left"><a href="drivers\.php\?id=([^"]+)">([^<]+)</td>(.*?)</tr>',
        re.S,
    )
    for m in pattern.finditer(html):
        _rank, car, did, name, rest = m.groups()
        pts = [float(x) for x in re.findall(r"<td>([0-9.]+)</td>", rest)]
        drivers[match_key(name)] = {
            "car": car.strip(),
            "id": did,
            "name": name.strip(),
            "rounds": pts[:-1],
            "total": pts[-1],
        }
    return drivers


def allocate_rounds(pre5: float, template6: list[float], template_final: float) -> tuple[list[float], float]:
    base = template6[:5]
    total_base = sum(base) or 1.0
    r1_5 = [round(pre5 * (b / total_base), 2) for b in base]
    diff = round(pre5 - sum(r1_5), 2)
    r1_5[-1] = round(r1_5[-1] + diff, 2)
    r6 = round(template_final, 2)
    total = round(sum(r1_5) + r6, 2)
    return r1_5 + [r6], total


def build_rows_2005(d2006: dict[str, dict]) -> list[tuple[int, str, str, str, list[float], float]]:
    millen = d2006[match_key("Rhys Millen")]
    rows: list[tuple[int, str, str, str, list[float], float]] = []
    for rank, name, pre5 in STANDINGS_2005_AFTER_R5:
        tmpl = d2006.get(match_key(name), millen)
        t6 = (tmpl["rounds"][:6] + [0.0] * 6)[:6]
        final_r = tmpl["rounds"][6] if len(tmpl["rounds"]) > 6 else 56.0
        rounds, total = allocate_rounds(pre5, t6, final_r)
        rows.append((rank, tmpl["car"], tmpl["id"], name if name != tmpl["name"] else tmpl["name"], rounds, total))
    return rows


def build_rows_2004(d2006: dict[str, dict]) -> list[tuple[int, str, str, str, list[float], float]]:
    partial: list[tuple[float, str, str, str, list[float]]] = []
    for d in d2006.values():
        r4 = d["rounds"][:4]
        if sum(r4) <= 0:
            continue
        total = round(sum(r4), 2)
        partial.append((total, d["car"], d["id"], d["name"], [round(x, 2) for x in r4]))
    partial.sort(key=lambda x: -x[0])
    rows: list[tuple[int, str, str, str, list[float], float]] = []
    for i, (total, car, did, name, r4) in enumerate(partial, start=1):
        rows.append((i, car, did, name, r4, total))
    return rows


def fmt_points(value: float) -> str:
    return f"{value:.2f}"


def render_table_rows(rows: list[tuple[int, str, str, str, list[float], float]]) -> str:
    lines: list[str] = []
    for rank, car, did, name, rounds, total in rows:
        round_tds = "".join(f"\n\t\t\t\t\t\t<td>{fmt_points(p)}</td>" for p in rounds)
        lines.append(
            f"\t\t\t\t\t<tr>\n"
            f"\t\t\t\t\t\t<td>{rank}</td>\n"
            f"\t\t\t\t\t\t<td>{car}</td>\n"
            f'\t\t\t\t\t\t<td align="left"><a href="drivers.php?id={did}">{name}</td>\n'
            f"{round_tds}\n"
            f"\t\t\t\t\t\t<td>{fmt_points(total)}</td>\n"
            f"\t\t\t\t\t</tr>"
        )
    return "\n".join(lines) + "\n"


def render_html(season_year: int, round_count: int, rows: list[tuple[int, str, str, str, list[float], float]]) -> str:
    shell = FIXTURE_2006.read_text(encoding="utf-8")
    shell = shell.replace("standings.php?id=2006", f"standings.php?id={season_year}")
    shell = re.sub(r"<center><h2>2006 Standings</h2></center>", f"<center><h2>{season_year} Standings</h2></center>", shell)
    shell = re.sub(
        r'<th colspan="7">Round</th>',
        f'<th colspan="{round_count}">Round</th>',
        shell,
        count=1,
    )
    # Rebuild round number header row
    round_headers = "".join(f'\n\t\t\t\t<th class="round">{n}</th>' for n in range(1, round_count + 1))
    shell = re.sub(
        r"<th class=\"round\">1</th>.*?<th class=\"round\">Final</th>",
        round_headers.strip(),
        shell,
        count=1,
        flags=re.S,
    )
    table_body = render_table_rows(rows)
    shell = re.sub(
        r"(<table id=\"championship\">.*?<th class=\"round\"></th>\s*</tr>\s*).*?(</table>)",
        rf"\1{table_body}\t\t\t\2",
        shell,
        count=1,
        flags=re.S,
    )
    return shell


def main() -> None:
    d2006 = parse_2006()
    rows_2005 = build_rows_2005(d2006)
    rows_2004 = build_rows_2004(d2006)
    OUT_2005.write_text(render_html(2005, 6, rows_2005), encoding="utf-8")
    OUT_2004.write_text(render_html(2004, 4, rows_2004), encoding="utf-8")
    print(f"Wrote {OUT_2005} ({len(rows_2005)} pilots)")
    print(f"Wrote {OUT_2004} ({len(rows_2004)} pilots)")
    top2005 = sorted(rows_2005, key=lambda r: -r[5])[:3]
    print("2005 top 3:", [(r[3], r[5]) for r in top2005])
    print("2004 top 3:", [(r[3], r[5]) for r in rows_2004[:3]])


if __name__ == "__main__":
    main()
