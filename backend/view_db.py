import argparse
import sqlite3
from pathlib import Path
import re
from datetime import datetime
import shutil


def is_write_sql(sql: str) -> bool:
    first = sql.strip().split(maxsplit=1)
    if not first:
        return False
    return first[0].upper() in {
        "INSERT",
        "UPDATE",
        "DELETE",
        "REPLACE",
        "CREATE",
        "DROP",
        "ALTER",
    }


def backup_db(db_path: Path) -> Path:
    backup_dir = db_path.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{db_path.stem}_{stamp}.bak"
    shutil.copy2(db_path, backup_path)
    return backup_path


def print_rows(rows: list[sqlite3.Row]) -> None:
    if not rows:
        print("No rows returned.")
        return

    headers = rows[0].keys()
    print(" | ".join(headers))
    print("-" * 80)
    for row in rows:
        print(" | ".join(str(row[h]) for h in headers))


def main() -> None:
    parser = argparse.ArgumentParser(description="Quick SQLite viewer for local badminton DB")
    parser.add_argument("--db", default="backend/badminton_dev.db", help="Path to sqlite .db file")
    parser.add_argument("--table", help="Table name to preview")
    parser.add_argument("--limit", type=int, default=20, help="Rows to preview when --table is provided")
    parser.add_argument("--sql", help="Run a single SQL statement directly")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Allow write SQL (INSERT/UPDATE/DELETE/DDL). A backup is created before write.",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if args.sql:
        write_mode = is_write_sql(args.sql)
        if write_mode and not args.yes:
            raise SystemExit(
                "Write SQL detected. Re-run with --yes to allow write. "
                "Example: python backend/view_db.py --sql \"UPDATE users SET full_name='A' WHERE id=1\" --yes"
            )

        if write_mode:
            backup_path = backup_db(db_path)
            print(f"Backup created: {backup_path}")

        cur.execute(args.sql)
        if cur.description is not None:
            rows = cur.fetchall()
            print_rows(rows)
        else:
            conn.commit()
            print(f"Done. Rows affected: {cur.rowcount}")
        return

    if not args.table:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        print("Tables:")
        for name in tables:
            print(f"- {name}")
        print("\nUse: python backend/view_db.py --table <table_name> --limit 20")
        print("Or:  python backend/view_db.py --sql \"SELECT * FROM users LIMIT 5\"")
        return

    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", args.table):
        raise SystemExit("Invalid table name. Use letters, numbers, and underscores only.")

    cur.execute(f"SELECT * FROM {args.table} LIMIT ?", (args.limit,))
    rows = cur.fetchall()
    if not rows:
        print(f"Table '{args.table}' has no rows.")
        return
    print_rows(rows)


if __name__ == "__main__":
    main()
