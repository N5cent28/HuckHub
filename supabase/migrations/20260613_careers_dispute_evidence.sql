-- Dispute evidence notes for contested career profile claims
alter table career_impersonation_reports
  add column if not exists evidence_notes text,
  add column if not exists dispute_reason text default 'claim_conflict';
