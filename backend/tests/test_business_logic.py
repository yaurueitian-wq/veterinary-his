"""
業務邏輯單元測試（不需 DB 連線）

測試重點：
1. VALID_TRANSITIONS 狀態機正確性
2. 密碼 hash / verify 函式
3. JWT 建立 + 解碼 roundtrip
4. JWT 過期 token 應被拒絕
"""
from datetime import datetime

import pytest

from app.routers.visits import VALID_TRANSITIONS
from app.auth import hash_password, verify_password, create_access_token, decode_token


# ── 狀態機：VALID_TRANSITIONS ─────────────────────────────────────

ALL_STATUSES = {
    "registered", "triaged", "in_consultation",
    "pending_results", "completed", "admitted", "cancelled",
}


class TestValidTransitions:
    def test_all_statuses_defined(self):
        """所有狀態都在 VALID_TRANSITIONS 中"""
        assert set(VALID_TRANSITIONS.keys()) == ALL_STATUSES

    def test_no_self_transition(self):
        """不允許自我轉換（A → A）"""
        for status, targets in VALID_TRANSITIONS.items():
            assert status not in targets, (
                f"狀態 '{status}' 不應允許自我轉換"
            )

    def test_cancelled_has_no_outgoing(self):
        """cancelled 是終態，不允許往任何狀態轉換"""
        assert VALID_TRANSITIONS["cancelled"] == set(), (
            "cancelled 狀態不應有任何出口"
        )

    def test_active_statuses_can_transition_to_cancelled(self):
        """所有非 cancelled 狀態都能轉換至 cancelled"""
        active = ALL_STATUSES - {"cancelled"}
        for status in active:
            assert "cancelled" in VALID_TRANSITIONS[status], (
                f"狀態 '{status}' 應能轉換至 'cancelled'"
            )

    def test_completed_can_transition(self):
        """completed 仍可轉換（如轉住院），不是終態"""
        assert len(VALID_TRANSITIONS["completed"]) > 0

    def test_targets_are_valid_statuses(self):
        """所有轉換目標都是合法狀態"""
        for status, targets in VALID_TRANSITIONS.items():
            for target in targets:
                assert target in ALL_STATUSES, (
                    f"狀態 '{status}' 的轉換目標 '{target}' 不是合法狀態"
                )

    def test_transition_count_is_reasonable(self):
        """每個 active 狀態的可轉換目標數量應 >= 1"""
        active = ALL_STATUSES - {"cancelled"}
        for status in active:
            assert len(VALID_TRANSITIONS[status]) >= 1, (
                f"狀態 '{status}' 的可轉換目標過少"
            )


# ── 密碼 hash / verify ────────────────────────────────────────────

class TestPasswordAuth:
    def test_hash_is_not_plaintext(self):
        hashed = hash_password("my_secret")
        assert hashed != "my_secret"

    def test_verify_correct_password(self):
        password = "test_password_123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_same_password_different_hash(self):
        """bcrypt 每次 hash 應產生不同的 salt（不重複）"""
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2

    def test_both_hashes_verify_correctly(self):
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert verify_password("same_password", h1) is True
        assert verify_password("same_password", h2) is True


# ── JWT roundtrip ─────────────────────────────────────────────────

class TestJWT:
    def _make_payload(self) -> dict:
        return {
            "sub": "user@his.local",
            "org_id": 1,
            "clinic_id": 2,
            "roles": ["vet"],
        }

    def test_roundtrip(self):
        payload = self._make_payload()
        token = create_access_token(payload)
        decoded = decode_token(token)
        assert decoded["sub"] == payload["sub"]
        assert decoded["org_id"] == 1
        assert decoded["clinic_id"] == 2
        assert decoded["roles"] == ["vet"]

    def test_token_is_string(self):
        token = create_access_token(self._make_payload())
        assert isinstance(token, str)
        assert len(token) > 0

    def test_expired_token_raises(self):
        """過期 token 應拋出例外（不回傳資料）"""
        from datetime import timedelta, timezone
        from jose import jwt
        from app.config import settings

        # 直接建立一個 exp 已過期的 token
        payload = self._make_payload()
        payload["exp"] = datetime.now(timezone.utc) - timedelta(minutes=1)
        expired_token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
        with pytest.raises(Exception):
            decode_token(expired_token)

    def test_tampered_token_raises(self):
        """竄改 token 應拋出例外"""
        token = create_access_token(self._make_payload())
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(Exception):
            decode_token(tampered)
