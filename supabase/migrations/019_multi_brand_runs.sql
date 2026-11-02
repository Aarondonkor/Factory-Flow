-- FactoryFlow: one printing run can print rolls for several brands.
--
-- Each brand in a run is stored as its own production_runs row, so everything
-- that already works per row keeps working per brand: the brand's own roll
-- weights become individual rolls, its stock is credited, and the semi-finished
-- roll it used is deducted. All the rows of one printing session are inserted
-- in a single statement (all saved, or none), and share a run_group_id so the
-- app can show them together as one run.
--
-- Run-level notes and downtime are stored on the first row only, so they are
-- not double counted.

ALTER TABLE production_runs
  ADD COLUMN run_group_id UUID;

CREATE INDEX idx_production_runs_group ON production_runs(run_group_id);

COMMENT ON COLUMN production_runs.run_group_id IS
  'Rows that share this id are the brands printed in a single production run. NULL for runs with one output.';
