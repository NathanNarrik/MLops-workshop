# Workshop presentation

Open `SoDA-MLOps-Workshop.pptx` in PowerPoint. The 38 slides include a timed presenter script in speaker notes. All text remains editable.

Slides **1–13** introduce ML and MLOps for beginners before any live demo. They explain training versus inference, versioning, reproducible pipelines, serving and deployment, monitoring and drift, and automated release checks. The live demo begins on **slide 14 at minute 15**. The complete session remains 60 minutes.

The deck imports the original SoDA master and layout from the supplied presentation: 10 × 5.625 inches, grid background, pink/blue top stripe, original SoDA logo, and Space Grotesk. It changes the workshop content and removes old workshop links and QR codes. `assets/theme.pptx` is a stripped theme carrier derived from that source. The source presentation is not modified.

Install **Space Grotesk** on the presenting computer for matching typography. The app's bundled font and its SIL license are in `app/static/`. PowerPoint can substitute a font when it is unavailable, so rehearse on the actual presenting computer.

`content.json` contains the editable copy and presenter notes. `build.mjs` uses the Codex artifact-tool authoring runtime. It is not part of the demo runtime and students do not need to run it. To rebuild in a compatible authoring environment, provide `@oai/artifact-tool`, set `PRESENTATION_SKILL_DIR`, `PRESENTATION_PYTHON`, and `RUNTIME_NODE_MODULES`, and run it from the repository root. Set `DECK_FILENAME` to a new filename for each rebuild because the finalizer preserves existing outputs. Finalization and private renders stay under `.work/`.

The deck uses real app screenshots. Refresh those assets if the UI changes. The baseline accuracy is a measured workshop result; update it if the model or evaluation changes. Deployment commands contain an explicit `YOUR-SERVICE` placeholder because no hosted service has been created yet.
