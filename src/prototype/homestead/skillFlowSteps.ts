import type { SkillSession, SkillStep } from './skillFlowModel'

export function skillCommand(step: SkillStep, session: SkillSession) {
  const file = `/demo/workflows/${session.workflow.id}.json`
  const buildId =
    session.request?.mode === 'update'
      ? session.request.sourceId
      : (session.target?.buildId ?? 'demo-build')
  const deployment = `${buildId}/workflow`
  const commands: Partial<Record<SkillStep, string>> = {
    skill: 'comfy skills show comfy-run-on-cloud',
    locate: 'comfy --json which\ncomfy --json env',
    inventory: `comfy --json build inventory ${file} --cloud --server http://127.0.0.1:8000 --desktop --models-root /demo/shared-models --input-root /demo/ComfyUI/input`,
    cloud:
      'compare inventory against Cloud node definitions and verified model digests',
    convert: 'write converted copy; preserve original workflow JSON',
    existing:
      'comfy --json build ls\ncomfy --json build show --id <candidate-id>',
    limits:
      'comfy --json deploy ls\ncomfy --json build release ls --id <candidate-id>',
    manifest:
      session.request?.mode === 'update'
        ? `comfy build pull /demo/build --id ${session.request.sourceId} --yes\n# Preserve id, syncedRevision and unrelated dependencies`
        : session.request?.scope === 'instance'
          ? 'comfy build init /demo/ComfyUI --name <approved-name> --python /demo/ComfyUI/.venv/bin/python'
          : `comfy --json build init /demo/build --name <approved-name> --from-workflow ${file} --comfy-version <local-version>`,
    dryRun: 'comfy build validate\ncomfy build push --dry-run',
    inputCheck:
      'review inventoried input paths and verified Cloud copies; do not upload without approval',
    uploads:
      'send only explicitly approved files to their disclosed workspace destination',
    push: 'comfy build push',
    release: 'comfy build release create --target linux/nvidia --watch',
    deploy: `comfy deploy up /demo/build --gpu <approved-gpuClass> --region ${session.request?.region ?? '<approved-region>'} --min 0 --max 1${session.request?.mode === 'update' ? ` --deployment ${deployment}` : ''} --watch`,
    logs: `comfy --json deploy show --deployment ${session.route === 'existing' ? `${session.target?.buildId ?? session.target?.id}/workflow` : deployment}\ncomfy --json deploy logs`,
    assetPlan: `comfy --json build inventory /demo/api.json --input-root /demo/ComfyUI/input\n# Reconcile deployment_assets and automatic roots with approved files`,
    validate:
      'comfy run --workflow /demo/cloud-copy.json --print-prompt --where cloud\ncomfy --json workflow validate --workflow /demo/api.json --where cloud',
    test:
      session.route === 'stock'
        ? 'comfy --json run --workflow /demo/cloud-copy.json --where cloud --wait'
        : `comfy deploy run /demo/build --deployment ${session.route === 'existing' ? `${session.target?.buildId ?? session.target?.id}/workflow` : deployment} --workflow /demo/api.json --asset-root /demo/ComfyUI/input`,
    download: 'comfy --json download <verified-prompt-id>',
    save: 'comfy --json workflow save /demo/cloud-copy.json --name <workflow-name> --no-overwrite --where cloud',
    readback:
      'list/read back saved sidebar userdata; verify name, size and unambiguous filename',
    handoff:
      session.route === 'stock'
        ? ''
        : `comfy deploy run /demo/build --deployment ${session.target?.buildId ?? session.target?.id}/workflow --workflow /demo/api.json\ncomfy deploy stop /demo/build --deployment ${session.target?.buildId ?? session.target?.id}/workflow`,
    repair:
      'comfy skills show comfy-build-failures\n# Repair one diagnosed cause; preserve the previous working revision'
  }
  return commands[step] ?? ''
}
