# Cloud Extension Manager

Open `/prototype/homestead?v=2&flow=extensions`. This opt-in journey starts in Cloud with a compatible workflow and a searchable node-pack list beside the real editor. Homestead V1–V3 journeys remain available without `flow=extensions`.

Choose versions to add or update installed packs; removing a pack is an explicit reviewed change and never deletes graph nodes. **Add from GitHub or ZIP** accepts a repository URL or ZIP filename as metadata. Close and reopen the panel to retain selections within the current page session.

**Review changes** defaults to updating the current shared environment. **Create a new environment** inherits editable packs, models, GPU and storage settings. Review shows illustrative GPU rates of $0.0012/second for A100 or $0.0006/second for L40S, plus $0.07/GB-month storage. These sample rates are not quotes or authoritative billing inputs.

**Prepare environment** opens a dismissible status panel. Keep editing and submitting Run jobs on the working revision. Reopen progress through the persistent status indicator. Readiness and its email preview never authorize a switch: explicitly choose **Approve and apply environment**. Approval pauses new submissions for everyone on the shared target; accepted running and queued jobs finish on the old revision before it switches. Unrelated environments stay runnable. The canvas, unsaved inputs and outputs remain in place. Creating new preserves the source and selects the new environment only for the initiating workflow, including when another workflow is active at completion. This session-selection behavior is a demo default pending product decisions.

Use **Demo scenarios & inbox** to select an existing environment, first-time setup, or the M2 team-request preview. Controls can simulate preparation failure, hold accepted jobs, seed running/queued jobs, or finish the next job. Close this overlay before interacting with the underlying panel. Failure retains selections and offers retry, edit, and copying repair context to local Codex/Claude. M2 previews all-admin requests, preselected review and requester availability after explicit application.

First-time setup links to the [existing creation UI](https://platform.comfy.org/profile/builds/new); no replacement wizard or paid-tier gate is introduced. After application, selected RMBG/Acme fixture nodes appear in editor search and have insertion shortcuts. Other packs are manifest simulations.

All preparation, jobs, roles, notifications and environment changes are local simulations. There is no GPU execution, billing, upload, repository fetch, real email, production mutation or integrated repair. Refresh resets the demo; persistence across refresh or tab closure is not promised.
