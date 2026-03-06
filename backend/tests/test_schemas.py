"""
Pydantic Schema 驗證測試（不需 DB 連線）

測試重點：
1. 正確資料能正常建立 schema 物件
2. 非法資料會觸發 ValidationError
3. 選填欄位缺席時使用正確預設值
"""
import pytest
from pydantic import ValidationError

from app.schemas.visits import VisitCreate, VisitUpdate, VisitListItem
from app.schemas.clinical import (
    NursingNoteCreate,
    SoapNoteCreate,
    SoapDiagnosisCreate,
    LabOrderCreate,
    LabResultItemCreate,
    LabResultSubmit,
)


# ── VisitCreate ──────────────────────────────────────────────────

class TestVisitCreate:
    def test_valid_normal_priority(self):
        v = VisitCreate(animal_id=1, chief_complaint="嘔吐")
        assert v.priority == "normal"
        assert v.animal_id == 1

    def test_valid_urgent_priority(self):
        v = VisitCreate(animal_id=2, chief_complaint="呼吸困難", priority="urgent")
        assert v.priority == "urgent"

    def test_invalid_priority_raises(self):
        with pytest.raises(ValidationError):
            VisitCreate(animal_id=1, chief_complaint="測試", priority="emergency")

    def test_missing_chief_complaint_raises(self):
        with pytest.raises(ValidationError):
            VisitCreate(animal_id=1)

    def test_missing_animal_id_raises(self):
        with pytest.raises(ValidationError):
            VisitCreate(chief_complaint="嘔吐")


# ── VisitUpdate ──────────────────────────────────────────────────

class TestVisitUpdate:
    VALID_STATUSES = [
        "registered", "triaged", "in_consultation",
        "pending_results", "completed", "admitted", "cancelled",
    ]

    @pytest.mark.parametrize("status", VALID_STATUSES)
    def test_valid_status(self, status: str):
        v = VisitUpdate(status=status)
        assert v.status == status

    def test_invalid_status_raises(self):
        with pytest.raises(ValidationError):
            VisitUpdate(status="unknown_status")

    def test_invalid_priority_raises(self):
        with pytest.raises(ValidationError):
            VisitUpdate(priority="high")

    def test_all_fields_optional(self):
        # 空 VisitUpdate 應合法（所有欄位為 None）
        v = VisitUpdate()
        assert v.status is None
        assert v.priority is None
        assert v.attending_vet_id is None

    def test_valid_priority_update(self):
        v = VisitUpdate(priority="urgent")
        assert v.priority == "urgent"


# ── VisitListItem ────────────────────────────────────────────────

class TestVisitListItem:
    def test_has_pending_lab_defaults_to_false(self):
        """has_pending_lab 預設應為 False"""
        from datetime import datetime
        item = VisitListItem(
            id=1,
            animal_id=1,
            animal_name="小白",
            species_name="犬",
            owner_id=1,
            owner_name="王小明",
            attending_vet_id=None,
            attending_vet_name=None,
            status="registered",
            priority="normal",
            chief_complaint="健康檢查",
            registered_at=datetime.now(),
        )
        assert item.has_pending_lab is False


# ── NursingNoteCreate ────────────────────────────────────────────

class TestNursingNoteCreate:
    def test_valid(self):
        n = NursingNoteCreate(note_text="觀察呼吸正常")
        assert n.note_text == "觀察呼吸正常"

    def test_empty_string_is_valid(self):
        # Pydantic 不拒絕空字串（空字串語義由應用層判斷）
        n = NursingNoteCreate(note_text="")
        assert n.note_text == ""

    def test_missing_note_text_raises(self):
        with pytest.raises(ValidationError):
            NursingNoteCreate()


# ── SoapNoteCreate ───────────────────────────────────────────────

class TestSoapNoteCreate:
    def test_all_optional(self):
        s = SoapNoteCreate()
        assert s.subjective is None
        assert s.objective is None
        assert s.plan is None
        assert s.diagnoses == []

    def test_with_diagnoses(self):
        s = SoapNoteCreate(
            subjective="飼主表示食慾不振三天",
            diagnoses=[SoapDiagnosisCreate(free_text="急性胃炎（疑）")]
        )
        assert len(s.diagnoses) == 1
        assert s.diagnoses[0].free_text == "急性胃炎（疑）"


# ── LabOrderCreate ───────────────────────────────────────────────

class TestLabOrderCreate:
    def test_valid(self):
        o = LabOrderCreate(test_type_id=1)
        assert o.test_type_id == 1
        assert o.notes is None

    def test_missing_test_type_id_raises(self):
        with pytest.raises(ValidationError):
            LabOrderCreate()

    def test_with_notes(self):
        o = LabOrderCreate(test_type_id=2, notes="緊急")
        assert o.notes == "緊急"


# ── LabResultItemCreate ──────────────────────────────────────────

class TestLabResultItemCreate:
    def test_missing_analyte_id_raises(self):
        with pytest.raises(ValidationError):
            LabResultItemCreate()

    def test_numeric_value(self):
        item = LabResultItemCreate(analyte_id=1, value_numeric=7.5, is_abnormal=False)
        assert item.value_numeric == pytest.approx(7.5)
        assert item.is_abnormal is False

    def test_text_value(self):
        item = LabResultItemCreate(analyte_id=2, value_text="中性")
        assert item.value_text == "中性"
        assert item.value_numeric is None


# ── LabResultSubmit ──────────────────────────────────────────────

class TestLabResultSubmit:
    def test_empty_items_list(self):
        # 允許空 items（應用層可自行決定是否接受）
        s = LabResultSubmit(items=[])
        assert s.items == []

    def test_multiple_items(self):
        s = LabResultSubmit(items=[
            LabResultItemCreate(analyte_id=1, value_numeric=10.2),
            LabResultItemCreate(analyte_id=2, value_text="正常"),
        ])
        assert len(s.items) == 2

    def test_missing_items_raises(self):
        with pytest.raises(ValidationError):
            LabResultSubmit()
