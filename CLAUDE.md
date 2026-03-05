# 獸醫診所 HIS 系統 — 專案指令

> 建立日期：2026-03-03
> 狀態：需求收集 / 設計階段（尚未進入開發）

---

## 專案背景

以 GNU Health HIS 3.6 為架構參考（詳見 `README.md`），開發一套針對**寵物 / 動物診所連鎖**設計的 HIS 系統。

- 規模：約 5 間連鎖分院，中型動物醫院
- 動物類型：全類型（伴侶動物、特殊寵物、大型動物）
- 參考資料：`README.md`（GNU Health 完整分析）、`SPEC.md`（需求規格）、`DECISIONS.md`（決策紀錄）

---

## 核心文件

| 文件 | 用途 |
|------|------|
| `README.md` | GNU Health HIS 3.6 完整分析，作為設計參考基準 |
| `SPEC.md` | 系統需求規格（功能範疇、待確認事項） |
| `DECISIONS.md` | ADR 決策紀錄（架構、技術選型等重要決策） |
| `SCHEMA.md` | 資料庫 Schema（所有表定義、約束、索引） |
| `CLAUDE.md` | 本文件，專案工作規則與流程 |

---

## 需求收集與決策流程規則

1. **逐步確認**：每次討論只推進 1-2 個決策點，不跳躍
2. **同步更新文件**：每次需求討論有新共識，立即更新 `SPEC.md` 或 `DECISIONS.md`
3. **決策格式（ADR）**：所有重要決定須記錄背景、選項、決定、理由，格式見 `DECISIONS.md`
4. **待確認事項**：未決事項統一列在 `SPEC.md § 四、待確認事項`，不做假設性推進

---

## 設計原則（GNU Health 借鑑 + 獸醫場景調整）

### 核心模型差異（vs GNU Health）

| GNU Health | 本系統 |
|-----------|--------|
| `party_party`（人） | `party`（飼主 / 機構 / 人員） |
| `gnuhealth_patient`（病患） | `animal`（動物，含物種/品種） |
| 無 | `owner`（飼主，1:N 對應動物） |
| 單一物種（人） | 多物種（需物種特定欄位） |

### 沿用的設計模式

- **Party Pattern**：單一實體表作為所有人員、機構的基底
- **State Machine**：掛號、病歷、住院狀態轉換在應用層管理
- **多院所架構**：資料表保留 `institution_id`（分院識別）

---

## 工具與環境

- Frontend：React + TypeScript + shadcn/ui
  - 搭配：TanStack Table、React Hook Form、Zod
- Backend：FastAPI (Python)
  - ORM：SQLAlchemy + Alembic（schema migration）
- Database：PostgreSQL
- 部署：Docker + Docker Compose + Nginx
- 語言版本 / 套件管理器：待開發環境建立時確認

---

## Git 工作流程（預設，進入開發後確認）

### 策略：GitHub Flow
- `main` 永遠保持可部署狀態
- 功能開發使用短命 branch，完成後 squash merge

### Branch 命名
- 格式：`類型/簡短描述`，例如 `feat/animal-registration`
- 類型：`feat`、`fix`、`hotfix`、`chore`、`docs`

### Commit message（Conventional Commits）
- 格式：`類型: 簡短描述`，例如 `feat: add animal registration form`

---

## 設計原則：無規範字串（ADR-008）

Schema 中盡量避免無約束的自由字串，依以下三層策略處理：

| 層次 | 適用情境 | 實作 |
|------|---------|------|
| **CHECK 約束** | 開發者定義、固定集合（狀態機、性別、標籤） | `VARCHAR + CHECK (value IN (...))` |
| **目錄表（Catalog）** | 管理員可增減的詞彙集（物種、品種、診斷碼、檢驗項目） | 獨立 catalog 表 + FK + `is_active` |
| **自由文字** | 不可避免的臨床敘述 | `TEXT`，在文件中說明原因 |

---

## 設計原則：設計縫隙，不預建功能

對於「確定未來需要，但 MVP 不實作」的功能，採以下策略：

- **Schema**：預留欄位（nullable、varchar 而非 enum、boolean flag），確保未來加功能不需破壞性 migration
- **邏輯**：不實作任何對應的 business logic
- **文件**：在 DECISIONS.md 記錄「未來功能」與「預留設計」的對應關係

判斷標準：若「事後加欄位 / 改約束」的成本高（影響現有資料或大範圍應用層程式碼），則應預留；若只需加邏輯或 UI，則不需預留。

---

## 專案特定規則

1. **Schema 設計參考**：新增資料表前，先查閱 `README.md` 對應的 GNU Health 表結構，再決定沿用或改寫
2. **命名語言**：資料庫欄位、API 路由、程式碼一律使用英文；文件、註解使用繁體中文
3. **多院所識別**：所有業務資料表須包含 `clinic_id` 欄位（對應分院）
4. **動物 vs 人**：設計時注意「飼主」和「動物」是獨立實體，不共用同一張表
5. **TECH_DEBT.md**：發現可改善的技術債務時，append 至 `TECH_DEBT.md`，格式：
   ```
   - [ ] `路徑:行號` — 問題說明
     - 依據：[對應原則]
     - 建議：具體改善方向
   ```
