# 技術債務記錄

> 格式：`路徑:行號` — 問題說明 → 依據原則 → 建議改善方向

---

- [ ] `SCHEMA.md: animals.sex` — `sex` 欄位以 `'intact_male' / 'neutered_male'` 等值將「生物性別」與「絕育狀態」合併編碼，違反單一職責原則。
  - 依據：[無規範字串原則 ADR-008 / 欄位職責單一]
  - 建議：分拆為 `sex VARCHAR(10) CHECK (sex IN ('male', 'female', 'unknown'))` + `is_neutered BOOLEAN NOT NULL DEFAULT FALSE`，以 `neutered_date`（已存在）補充絕育日期。
  - 影響範圍：`animals` 表 CHECK 約束、應用層查詢、前端表單（性別下拉需同時呈現兩個維度）
  - 優先級：低（MVP 目前能用；分拆需 migration + 前後端配合修改）
