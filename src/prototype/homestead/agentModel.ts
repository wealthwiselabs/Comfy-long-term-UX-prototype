import { z } from 'zod'
import type { Environment, Workflow } from './model'

export type DesktopBuildRequest = {
  name: string
  gpu: string
  instructions: string
  scope?: 'workflow' | 'instance'
  region?: string
} & (
  | { mode: 'create' }
  | { mode: 'update'; sourceId: string; sourceEnvironmentId?: string }
)

export interface AgentRun {
  request: DesktopBuildRequest
  workflow: Workflow
  workspace: string
  prompt: string
  sourceRevision?: string
}

export function localAgentPrompt(workflow: Workflow, workspace: string) {
  return `Run my workflow on Comfy Cloud. Read comfy skills show comfy-run-on-cloud first.\nWorkflow: ${workflow.name} (simulated active-canvas handoff; production supplies a saved file path)\nWorkspace: ${workspace}\nCheck stock Cloud, verified lossless conversion, and existing workspace Builds before proposing a custom build. Preserve the original workflow. Ask before lossy changes or any local file upload. If a custom build is needed, ask for scope, new versus named update, name, GPU and region. Verify a real job before claiming it runs. Return a verified UI link only when supported; otherwise explain the sidebar/API handoff.`
}

export function desktopBuildPrompt(
  request: DesktopBuildRequest,
  workflow: Workflow,
  workspace: string
) {
  const target =
    request.mode === 'create'
      ? `Create a new build named "${request.name}".`
      : `Prepare a new revision of build "${request.name}" (build ID: ${request.sourceId}). Keep the working revision available until I switch.`
  return `${localAgentPrompt(workflow, workspace)}\n\nApproved custom-build target: ${target}\nGPU: ${request.gpu}\nRegion: ${request.region ?? 'ask if unknown'}\nScope: ${request.scope ?? 'workflow'}\nWorker bounds: 0–1\nNode packs: ${workflow.packs.join(', ') || 'ComfyUI core'}\nModels: ${workflow.models.join(', ') || 'Default models'}\nPackage only the approved scope. Report progress and logs. Ask for missing files or credentials. Read import logs and verify a real job.${request.instructions.trim() ? `\n\nAdditional instructions:\n${request.instructions.trim()}` : ''}`
}

export function latestBuilds(environments: Environment[]) {
  const families = new Map<string, Environment>()
  for (const environment of environments) {
    if (!environment.verified || environment.id === 'dep-comfy-cloud') continue
    const id = environment.buildId ?? environment.id
    const previous = families.get(id)
    if (
      !previous ||
      Number(environment.revision.slice(1)) > Number(previous.revision.slice(1))
    )
      families.set(id, environment)
  }
  return [...families.values()]
}

export const deploymentLinkSchema = z.object({
  environment: z.object({
    id: z.string(),
    buildId: z.string().optional(),
    name: z.string(),
    revision: z.string(),
    gpu: z.string(),
    packs: z.array(z.string()),
    models: z.array(z.string()),
    verified: z.literal(true)
  }),
  workflow: z.object({
    id: z.string(),
    projectId: z.string().optional(),
    name: z.string(),
    description: z.string(),
    image: z.string(),
    packs: z.array(z.string()),
    models: z.array(z.string()),
    environmentId: z.string(),
    prompt: z.string(),
    steps: z.number(),
    seed: z.number(),
    saved: z.boolean(),
    positions: z.array(z.object({ x: z.number(), y: z.number() }))
  })
})

export function agentActivities(run: AgentRun) {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return [
    {
      kind: 'thinking',
      key: 'plan',
      input: '',
      output: `${run.workflow.name}\n${run.request.name} · ${run.request.gpu}`
    },
    {
      kind: 'skill',
      key: 'skill',
      input: 'comfy skills show comfy-run-on-cloud',
      output:
        'SKILL.md\ninspect → package → build → deploy → verify\npreserve_working_revision: true'
    },
    {
      kind: 'tool',
      key: 'inspect',
      input:
        'comfy --json build inventory workflow.json --cloud --server <local-server> --desktop --input-root <input-dir>',
      output: JSON.stringify(
        {
          node_packs: run.workflow.packs,
          models: run.workflow.models,
          scope: run.request.scope ?? 'workflow'
        },
        null,
        2
      )
    },
    {
      kind: 'tool',
      key: 'manifest',
      input: 'write_build_manifest({ preserve_local_versions: true })',
      output: `build: ${run.request.name}\ngpu: ${run.request.gpu}\nsource: current Desktop workflow\nmanifest: ready`
    },
    {
      kind: 'cli',
      key: 'package',
      input: 'comfy build validate && comfy build push --dry-run',
      output:
        '[1/3] Resolving node-pack versions\n[2/3] Reusing verified model references\n[3/3] Checking pins without uploading or saving\n✓ Dry-run checks complete'
    },
    {
      kind: 'cli',
      key: 'submit',
      input: 'comfy build push',
      output:
        '✓ Build accepted\n✓ Dependency resolution complete\n→ Container build queued'
    },
    {
      kind: 'cli',
      key: 'build',
      input: 'comfy build release create --target linux/nvidia --watch',
      output:
        '#1 Fetch base image                 CACHED\n#2 Install required node packs      DONE\n#3 Validate model references        DONE\n#4 Export image                     DONE\n✓ Build succeeded'
    },
    {
      kind: 'cli',
      key: 'deploy',
      input: `comfy deploy up <spec> --gpu ${quote(run.request.gpu)} --region ${quote(run.request.region ?? '<approved-region>')} --min 0 --max 1 --watch`,
      output:
        '→ Provisioning worker\n✓ Image pulled\n✓ ComfyUI started\n→ Waiting for readiness probe'
    },
    {
      kind: 'tool',
      key: 'health',
      input:
        'check_deployment({ readiness: true, workflow_dependencies: true })',
      output:
        'GET /system_stats → 200\nGET /object_info → 200\n✓ Required node packs imported without errors\n✓ Approved deployment asset plan reconciled\n✓ Test job completed with required inputs\n✓ Preview Open UI link ready (simulated product target)'
    }
  ]
}
