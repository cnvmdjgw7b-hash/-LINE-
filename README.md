# 永護寧 AI 居督資料庫

此 Repository 作為「永護寧 AI 居督工作台」資料庫與知識層主庫。

## 設計原則
- UI 與資料層分離：目前先強化資料庫，不改 UI。
- 個案唯一主檔：避免同案重複建立。
- 事件中心：家訪、電訪、照會、異動、LINE/電話/現場事件共用事件模型。
- 背景資料 ≠ 本次事實。
- AI 建議 ≠ 已完成處置。
- 正式規則與實務案例分層，規則具版本、生效日、失效日與來源。
- AI 錯誤與主管回饋獨立保存，供後續排序與防錯使用。

## 優先序
正式規範 > 永護寧有效內規 > 核准實務模式 > 歷史案例

## 目錄
- database/schema.sql：核心關聯式資料模型
- database/README.md：資料關聯與寫入規則
- knowledge/scenario-schema.json：1000+居督情境庫資料格式
- knowledge/reasoning-atoms.json：未知情境拆解原子
- knowledge/error-patterns.json：AI 防錯規則種子
- knowledge/scenario-categories.json：32大情境分類
