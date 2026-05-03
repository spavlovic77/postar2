-- Caches the rendered PDF for received Peppol documents so we don't pay
-- the rendering service per view. Rendering is deterministic (XML is
-- immutable per Peppol contract), so cache invalidation is unnecessary —
-- to force a re-render, set pdf_blob_url back to NULL.
--
-- pdf_validation stores the X-Peppol-Validation header from the renderer
-- (status, errors, warnings, documentType) so cached responses can replay
-- those headers without re-running the validator.

alter table public.documents
  add column if not exists pdf_blob_url text;

alter table public.documents
  add column if not exists pdf_validation jsonb;
