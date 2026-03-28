# LOINC 對應表

> LOINC 版本：2.82
> 建立日期：2026-03-28
> 依據：ADR-025

本表記錄 HIS 系統 `lab_analytes` 與 LOINC 國際標準編碼的對應關係。

## CBC（全血計數）

| 系統名稱 | LOINC Code | LOINC Name | System |
|---------|-----------|------------|--------|
| WBC（白血球） | 26464-8 | Leukocytes [#/volume] in Blood | Bld |
| RBC（紅血球） | 26453-1 | Erythrocytes [#/volume] in Blood | Bld |
| HGB（血紅素） | 20509-6 | Hemoglobin [Mass/volume] in Blood | Bld |
| HCT（血容比） | 20570-8 | Hematocrit [Volume Fraction] of Blood | Bld |
| PLT（血小板） | 26515-7 | Platelets [#/volume] in Blood | Bld |
| MCV（平均血球容積） | 787-2 | MCV [Entitic mean volume] in Red Blood Cells by Automated count | RBC |
| MCH（平均血球血色素） | 785-6 | MCH [Entitic mass] by Automated count | RBC |
| MCHC（平均血球血色素濃度） | 786-4 | MCHC [Entitic Mass/volume] in Red Blood Cells by Automated count | RBC |

## 血液生化（Biochemistry）

| 系統名稱 | LOINC Code | LOINC Name | System |
|---------|-----------|------------|--------|
| ALT（丙胺酸轉胺酶） | 1742-6 | Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma | Ser/Plas |
| AST（天門冬胺酸轉胺酶） | 1920-8 | Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma | Ser/Plas |
| ALP（鹼性磷酸酶） | 1783-0 | Alkaline phosphatase [Enzymatic activity/volume] in Blood | Bld |
| BUN（血尿素氮） | 14937-7 | Urea nitrogen [Moles/volume] in Serum or Plasma | Ser/Plas |
| Creatinine（肌酸酐） | 2160-0 | Creatinine [Mass/volume] in Serum or Plasma | Ser/Plas |
| Glucose（血糖） | 14743-9 | Glucose [Moles/volume] in Capillary blood by Glucometer | BldC |
| TP（總蛋白） | 2885-2 | Protein [Mass/volume] in Serum or Plasma | Ser/Plas |
| Albumin（白蛋白） | 1751-7 | Albumin [Mass/volume] in Serum or Plasma | Ser/Plas |
| Globulin | 10834-0 | Globulin [Mass/volume] in Serum by calculation | Ser |
| Ca（鈣） | 17861-6 | Calcium [Mass/volume] in Serum or Plasma | Ser/Plas |
| P（磷） | 14879-1 | Phosphate [Moles/volume] in Serum or Plasma | Ser/Plas |
| Cholesterol（膽固醇） | 14647-2 | Cholesterol [Moles/volume] in Serum or Plasma | Ser/Plas |
| Triglyceride（三酸甘油酯） | 2571-8 | Triglyceride [Mass/volume] in Serum or Plasma | Ser/Plas |
| T-Bili（總膽紅素） | 1975-2 | Bilirubin.total [Mass/volume] in Serum or Plasma | Ser/Plas |
| Na（鈉） | 2947-0 | Sodium [Moles/volume] in Blood | Bld |
| K（鉀） | 2823-3 | Potassium [Moles/volume] in Serum or Plasma | Ser/Plas |
| Cl（氯） | 2069-3 | Chloride [Moles/volume] in Blood | Bld |
| GGT（麩胺轉肽酶） | 2324-2 | Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma | Ser/Plas |
| Amylase（澱粉酶） | 1798-8 | Amylase [Enzymatic activity/volume] in Serum or Plasma | Ser/Plas |
| Lipase（脂肪酶） | 3040-3 | Lipase [Enzymatic activity/volume] in Serum or Plasma | Ser/Plas |

## 未對應項目

| 系統名稱 | 原因 |
|---------|------|
| WBC 分類 | 文字型態指標，非單一數值，LOINC 有多個子項（Neutrophils、Lymphocytes 等）分別編碼 |

## 擴充方向

- 尿液分析（UA）：pH、比重、蛋白質、葡萄糖等
- 凝血功能：PT、APTT、Fibrinogen
- 內分泌：T4、TSH、Cortisol
- 需要時從 LOINC 2.82 資料庫（`LOINC/Loinc_2.82/`，本機參考，不入 git）查找對應代碼
