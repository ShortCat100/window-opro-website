-- Run in Supabase SQL Editor.
-- One row per cart line (same layout as the cart page table).
-- Multiple projects in one submit are stacked into one flat list.

drop table if exists project_submissions;

-- If you already created cart_submission_rows with submission_batch_id, run this instead:
-- alter table cart_submission_rows drop column if exists submission_batch_id;
-- alter table cart_submission_rows drop column if exists submitted_at;
-- alter table cart_submission_rows add column if not exists submission_time text not null default '';
-- drop index if exists cart_submission_rows_batch_idx;

create table if not exists cart_submission_rows (
  id uuid primary key default gen_random_uuid(),
  submission_time text not null,
  email text not null,
  full_name text not null,
  company_name text not null,
  num_windows text,
  height_inch text,
  width_inch text,
  openings text,
  glass_type text,
  adding text,
  cost text,
  discount numeric(12, 2) not null default 0,
  total_cost numeric(12, 2) not null default 0
);

create index if not exists cart_submission_rows_email_idx
  on cart_submission_rows (email);

create index if not exists cart_submission_rows_time_idx
  on cart_submission_rows (submission_time);
