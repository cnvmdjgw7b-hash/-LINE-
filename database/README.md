# 資料庫規格

## 中心關係
cases → events → event_facts / event_actions / risk_history

個案背景由 case_profiles、care_plans、authorized_services、service_assignments 提供；事件可再連 visits、referrals_changes、communications。

## 強制資料規則
1. cases 為唯一個案主檔；外部身分證、衛福案號、機構案號均以 case_identifiers 管理並設唯一限制。
2. 所有「本次發生」先寫 events，再寫 event_facts。
3. 歷史背景只能作 reasoning_context，不得直接標記為 current_fact。
4. event_actions 必須區分 proposed / confirmed / completed；AI 不得自行把 proposed 升為 completed。
5. knowledge_rules 與 scenario_examples 分離；案例不得自動成為正式規則。
6. 正式規則保留 source、version、effective_from、effective_to、verified_at。
7. 每筆 AI 決策保留引用來源及 confidence，供人工追溯。
8. 敏感個資不得直接放入公開 GitHub。此 repo 只存 schema、規則結構、去識別情境資料；真實個案資料應放受控資料庫。

## 事件流程
原始輸入 → 個案比對 → Event → Facts → 風險/規則/相似經驗 → AI建議 → 督導決策 → Action → Outcome/Feedback
