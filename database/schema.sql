PRAGMA foreign_keys = ON;

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE case_identifiers (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  identifier_type TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  UNIQUE(identifier_type, identifier_hash)
);

CREATE TABLE case_profiles (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  profile_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  source_id TEXT,
  effective_from TEXT,
  effective_to TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE care_plans (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  version TEXT NOT NULL,
  content_json TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE authorized_services (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  service_code TEXT NOT NULL,
  quantity REAL,
  frequency_text TEXT,
  effective_from TEXT,
  effective_to TEXT,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE service_assignments (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  person_id TEXT NOT NULL REFERENCES people(id),
  assignment_role TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE source_documents (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_name TEXT,
  source_uri TEXT,
  source_date TEXT,
  checksum TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  event_time TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_id TEXT REFERENCES source_documents(id),
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  parent_event_id TEXT REFERENCES events(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE event_facts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  fact_text TEXT NOT NULL,
  fact_scope TEXT NOT NULL CHECK(fact_scope IN ('current_fact','historical_context','inference')),
  reported_by TEXT,
  confidence REAL,
  source_id TEXT REFERENCES source_documents(id),
  verified_status TEXT NOT NULL DEFAULT 'unverified',
  created_at TEXT NOT NULL
);

CREATE TABLE event_actions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  action_text TEXT NOT NULL,
  action_status TEXT NOT NULL CHECK(action_status IN ('proposed','confirmed','completed','cancelled')),
  actor_id TEXT REFERENCES people(id),
  evidence_source_id TEXT REFERENCES source_documents(id),
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE risk_history (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  event_id TEXT REFERENCES events(id),
  risk_label TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at TEXT,
  last_seen_at TEXT,
  metadata_json TEXT
);

CREATE TABLE visits (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(id),
  visit_type TEXT NOT NULL CHECK(visit_type IN ('home','phone')),
  client_status TEXT,
  service_status TEXT,
  client_family_response TEXT,
  intervention_plan TEXT,
  record_style TEXT,
  validated_at TEXT
);

CREATE TABLE referrals_changes (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(id),
  record_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  effective_at TEXT,
  followup_status TEXT
);

CREATE TABLE communications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  channel TEXT NOT NULL,
  speaker_role TEXT,
  emotion_state TEXT,
  audience_role TEXT,
  content TEXT NOT NULL
);

CREATE TABLE knowledge_rules (
  id TEXT PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_uri TEXT,
  original_text TEXT,
  ai_summary TEXT,
  applies_to_json TEXT,
  version TEXT,
  effective_from TEXT,
  effective_to TEXT,
  verified_at TEXT,
  replaces_rule_id TEXT REFERENCES knowledge_rules(id),
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE scenario_examples (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  event_types_json TEXT NOT NULL,
  actors_json TEXT,
  emotion_states_json TEXT,
  risk_labels_json TEXT,
  known_facts_json TEXT,
  critical_unknowns_json TEXT,
  rule_refs_json TEXT,
  safe_actions_json TEXT,
  unsafe_actions_json TEXT,
  reaction_strategies_json TEXT,
  example_phrasing_json TEXT,
  outcome_json TEXT,
  quality_score REAL DEFAULT 0,
  version TEXT NOT NULL DEFAULT '1',
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE reasoning_atoms (
  id TEXT PRIMARY KEY,
  atom_type TEXT NOT NULL,
  label TEXT NOT NULL UNIQUE,
  description TEXT,
  risk_weight REAL DEFAULT 0,
  metadata_json TEXT
);

CREATE TABLE ai_decisions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  model_version TEXT,
  classification_json TEXT,
  retrieved_rule_ids_json TEXT,
  retrieved_scenario_ids_json TEXT,
  candidate_actions_json TEXT,
  candidate_reactions_json TEXT,
  confidence REAL,
  requires_human_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE decision_feedback (
  id TEXT PRIMARY KEY,
  ai_decision_id TEXT NOT NULL REFERENCES ai_decisions(id),
  selected_option TEXT,
  edited_output TEXT,
  feedback_type TEXT,
  final_outcome TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE ai_error_patterns (
  id TEXT PRIMARY KEY,
  error_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  trigger_description TEXT NOT NULL,
  prevention_rule TEXT NOT NULL,
  severity TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  version TEXT NOT NULL DEFAULT '1'
);

CREATE INDEX idx_events_case_time ON events(case_id, event_time);
CREATE INDEX idx_facts_event ON event_facts(event_id);
CREATE INDEX idx_risks_case_label ON risk_history(case_id, risk_label);
CREATE INDEX idx_services_case_active ON authorized_services(case_id, status);
CREATE INDEX idx_assignments_case_active ON service_assignments(case_id, status);
