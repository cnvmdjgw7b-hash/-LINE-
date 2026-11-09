-- 永護寧 AI 資料品質檢核
-- 1. AI 建議不得冒充已完成
SELECT ea.id, ea.event_id, ea.action_text
FROM event_actions ea
WHERE ea.action_status='completed'
  AND ea.completed_at IS NULL;

-- 2. 正式規則不可同時標 active 且已失效
SELECT id, rule_name, effective_to
FROM knowledge_rules
WHERE status='active'
  AND effective_to IS NOT NULL
  AND effective_to < datetime('now');

-- 3. 事件必須有時間
SELECT id FROM events WHERE event_time IS NULL OR trim(event_time)='';

-- 4. current_fact 應盡量有來源；列出待人工檢核
SELECT id,event_id,fact_text
FROM event_facts
WHERE fact_scope='current_fact' AND source_id IS NULL AND verified_status='unverified';

-- 5. 高風險事件需人工覆核
SELECT e.id,e.case_id,e.event_type,e.risk_level
FROM events e
LEFT JOIN ai_decisions d ON d.event_id=e.id
WHERE e.risk_level IN ('high','critical')
GROUP BY e.id
HAVING MAX(COALESCE(d.requires_human_review,0))=0;
