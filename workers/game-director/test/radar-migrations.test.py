import json
import sqlite3
import unittest
from pathlib import Path


MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
VALID_FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "schemas"
    / "intelligence"
    / "fixtures"
    / "valid"
    / "obby.json"
)
CAPTURED_AT = "2026-07-14T00:00:00.000Z"
EXPIRES_AT = "2026-07-16T00:00:00.000Z"
VALID_HASH = "sha256:" + ("a" * 64)


def snapshot_payload(snapshot_id: str = "snapshot:1") -> str:
    fixture = json.loads(VALID_FIXTURE.read_text(encoding="utf-8"))
    snapshot = fixture["radarSnapshot"]
    snapshot["id"] = snapshot_id
    snapshot["asOf"] = CAPTURED_AT
    snapshot["expiresAt"] = EXPIRES_AT
    snapshot["createdAt"] = CAPTURED_AT
    return json.dumps(snapshot)


class RadarMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = sqlite3.connect(":memory:")
        for migration in sorted(MIGRATIONS.glob("*.sql")):
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.db.execute(
            """
            INSERT INTO radar_source_attempts VALUES
            ('attempt:1', 'roblox_public_chart', 'top_playing_now',
             'https://www.roblox.com/charts/top-playing-now', 'manual_verified',
             'en-AU', 'succeeded', NULL, '2026-07-14T00:00:00.000Z',
             '2026-07-14T00:01:00.000Z')
            """
        )
        self.db.execute(
            """
            INSERT INTO radar_corpus_records VALUES
            ('corpus:tower-of-hell-public-page', 'Tower of Hell public page',
             'https://www.roblox.com/games/1962086868/Tower-of-Hell', 'Roblox',
             '2026-07-14T00:00:00.000Z', '{}', '[]', '{}',
             '2026-07-14T00:01:00.000Z')
            """
        )
        self.db.execute(
            """
            INSERT INTO radar_captures VALUES
            ('capture:1', 'attempt:1', ?, ?, ?,
             '2026-07-14T00:01:00.000Z')
            """,
            (CAPTURED_AT, EXPIRES_AT, VALID_HASH),
        )
        self.db.execute(
            """
            INSERT INTO radar_observations VALUES
            ('capture:1', 703124385, 1962086868, 'Tower of Hell',
             'corpus:tower-of-hell-public-page',
             'https://www.roblox.com/games/1962086868/Tower-of-Hell',
             1, 1000, 2000, 300, 0.9, '2026-07-13T00:00:00.000Z',
             'evidence:tower-of-hell-public-visits', '[]', '[]', '[]')
            """
        )
        self.db.execute(
            """
            INSERT INTO radar_snapshots VALUES
            ('snapshot:1', 'capture:1', ?, ?,
             '2026-07-14T00:01:00.000Z')
            """,
            (snapshot_payload(), VALID_HASH),
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()

    def test_the_complete_published_evidence_graph_is_append_only(self) -> None:
        table_and_column = {
            "radar_source_attempts": "source_url",
            "radar_corpus_records": "subject",
            "radar_captures": "payload_hash",
            "radar_observations": "game_label",
            "radar_snapshots": "payload_json",
        }
        for table, column in table_and_column.items():
            with self.subTest(table=table, operation="update"):
                with self.assertRaisesRegex(sqlite3.DatabaseError, "immutable"):
                    self.db.execute(f"UPDATE {table} SET {column} = {column}")
            with self.subTest(table=table, operation="delete"):
                with self.assertRaisesRegex(sqlite3.DatabaseError, "immutable"):
                    self.db.execute(f"DELETE FROM {table}")

        score = self.db.execute("SELECT * FROM radar_ordinal_scores").fetchone()
        self.assertIsNotNone(score)
        with self.assertRaisesRegex(sqlite3.DatabaseError, "view"):
            self.db.execute("UPDATE radar_ordinal_scores SET score = 1")
        with self.assertRaisesRegex(sqlite3.DatabaseError, "view"):
            self.db.execute("DELETE FROM radar_ordinal_scores")

    def test_observation_identity_and_discontinuity_columns_are_persisted(self) -> None:
        columns = {
            row[1] for row in self.db.execute("PRAGMA table_info(radar_observations)")
        }
        self.assertTrue(
            {
                "universe_id",
                "root_place_id",
                "public_offers_json",
                "discontinuities_json",
            }.issubset(columns)
        )

    def test_parent_facts_cannot_be_duplicated_or_contradicted(self) -> None:
        capture_columns = {
            row[1] for row in self.db.execute("PRAGMA table_info(radar_captures)")
        }
        snapshot_columns = {
            row[1] for row in self.db.execute("PRAGMA table_info(radar_snapshots)")
        }
        self.assertTrue(
            {"public_sort", "source_url", "locale", "capture_mode"}.isdisjoint(
                capture_columns
            )
        )
        self.assertTrue(
            {"public_sort", "as_of", "expires_at"}.isdisjoint(snapshot_columns)
        )

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """
                INSERT INTO radar_source_attempts VALUES
                ('attempt:bad-source', 'roblox_public_chart', 'top_trending',
                 'https://www.roblox.com/charts/top-playing-now', 'browser_rendered',
                 'fr-FR', 'succeeded', NULL, ?, ?)
                """,
                (CAPTURED_AT, CAPTURED_AT),
            )

        self.db.execute(
            """
            INSERT INTO radar_source_attempts VALUES
            ('attempt:failed', 'roblox_public_chart', 'top_trending',
             'https://www.roblox.com/charts/top-trending', 'browser_rendered',
             'fr-FR', 'failed', 'source_refresh_failed', ?, ?)
            """,
            (CAPTURED_AT, CAPTURED_AT),
        )
        with self.assertRaisesRegex(
            sqlite3.DatabaseError, "requires_succeeded_attempt"
        ):
            self.db.execute(
                """
                INSERT INTO radar_captures VALUES
                ('capture:failed', 'attempt:failed', ?, ?, ?, ?)
                """,
                (CAPTURED_AT, EXPIRES_AT, VALID_HASH, CAPTURED_AT),
            )

        self.db.execute(
            """
            INSERT INTO radar_source_attempts VALUES
            ('attempt:2', 'roblox_public_chart', 'top_playing_now',
             'https://www.roblox.com/charts/top-playing-now', 'manual_verified',
             'en-AU', 'succeeded', NULL, ?, ?)
            """,
            (CAPTURED_AT, CAPTURED_AT),
        )
        self.db.execute(
            """
            INSERT INTO radar_captures VALUES
            ('capture:2', 'attempt:2', ?, ?, ?, ?)
            """,
            (CAPTURED_AT, EXPIRES_AT, VALID_HASH, CAPTURED_AT),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """
                INSERT INTO radar_observations VALUES
                ('capture:2', 201, 101, 'Different Public Example',
                 'corpus:tower-of-hell-public-page',
                 'https://www.roblox.com/games/101/example', 1, 1000, 2000, 300,
                 0.9, ?, 'evidence:tower-of-hell-public-visits', '[]', '[]', '[]')
                """,
                (CAPTURED_AT,),
            )
        contradictory = json.loads(snapshot_payload("snapshot:2"))
        contradictory["asOf"] = "2026-07-15T00:00:00.000Z"
        with self.assertRaisesRegex(sqlite3.DatabaseError, "capture_mismatch"):
            self.db.execute(
                """
                INSERT INTO radar_snapshots VALUES
                ('snapshot:2', 'capture:2', ?, ?, ?)
                """,
                (json.dumps(contradictory), VALID_HASH, CAPTURED_AT),
            )

        incomplete = json.dumps(
            {
                "schemaVersion": "1.0.0",
                "id": "snapshot:3",
                "asOf": CAPTURED_AT,
                "expiresAt": EXPIRES_AT,
            }
        )
        with self.assertRaisesRegex(sqlite3.DatabaseError, "contract_shape"):
            self.db.execute(
                """
                INSERT INTO radar_snapshots VALUES
                ('snapshot:3', 'capture:2', ?, ?, ?)
                """,
                (incomplete, VALID_HASH, CAPTURED_AT),
            )

        nested_invalid = json.loads(snapshot_payload("snapshot:4"))
        nested_invalid["entries"][0]["signals"] = []
        with self.assertRaisesRegex(sqlite3.DatabaseError, "contract_shape"):
            self.db.execute(
                """
                INSERT INTO radar_snapshots VALUES
                ('snapshot:4', 'capture:2', ?, ?, ?)
                """,
                (json.dumps(nested_invalid), VALID_HASH, CAPTURED_AT),
            )


if __name__ == "__main__":
    unittest.main()
