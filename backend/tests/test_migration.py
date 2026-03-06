"""
Migration 狀態測試

使用 `alembic check` 驗證：ORM model 定義與資料庫實際 schema 一致。
此測試需要 DB 連線，若 DB 不可用則自動跳過（不影響純邏輯測試）。
"""
import subprocess

import pytest


def _db_available() -> bool:
    """測試 DB 連線是否可用（讀取 alembic current 就足夠）"""
    result = subprocess.run(
        ["alembic", "current"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.returncode == 0


@pytest.mark.skipif(not _db_available(), reason="DB 不可用，跳過 migration 測試")
class TestMigrationSync:
    def test_alembic_check_passes(self):
        """
        alembic check 驗證 ORM metadata 與 DB 實際 schema 一致。
        若 ORM 有新增 model / 欄位 / 約束但尚未 migrate，此測試會失敗。
        """
        result = subprocess.run(
            ["alembic", "check"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, (
            f"alembic check 失敗 — ORM 與 DB schema 不同步。\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}\n"
            f"請執行 'make migrate' 更新資料庫。"
        )

    def test_alembic_heads_is_single(self):
        """
        確保 migration 歷史沒有分叉（多個 head）。
        多個 head 表示有衝突的 migration 分支。
        """
        result = subprocess.run(
            ["alembic", "heads"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0
        heads = [line for line in result.stdout.strip().splitlines() if line.strip()]
        assert len(heads) <= 1, (
            "Migration 歷史有多個 head（分叉），請合併：\n"
            + "\n".join(heads)
        )
