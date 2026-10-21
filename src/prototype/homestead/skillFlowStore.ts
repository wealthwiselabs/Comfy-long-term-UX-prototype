import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import type { DesktopBuildRequest } from './agentModel'
import type { Environment } from './model'
import {
  existingTarget,
  requiredUploads,
  stockCovers,
  stockTarget,
  verificationSteps
} from './skillFlowModel'
import type {
  SkillActivity,
  SkillHandoff,
  SkillScenario,
  SkillSession,
  SkillState,
  SkillStep,
  UploadKind
} from './skillFlowModel'
import { skillActivity } from './skillFlowActivity'
import {
  snapshotHandoff,
  snapshotEnvironments,
  updateSource,
  plannedTarget
} from './skillFlowTarget'

export const useSkillFlowStore = defineStore('homestead-skill-flow', () => {
  const state = ref<SkillState>({ phase: 'idle' })
  const session = ref<SkillSession | null>(null)
  const events = ref<SkillActivity[]>([])
  const approvedFiles = ref<string[]>([])
  const pendingFiles = computed(() =>
    session.value
      ? requiredUploads(session.value).filter(
          (file) => !approvedFiles.value.includes(file.name)
        )
      : []
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(timer))

  function append(
    step: SkillStep,
    status: SkillActivity['status'] = 'running'
  ) {
    if (session.value)
      events.value.push(
        skillActivity(
          step,
          session.value,
          approvedFiles.value,
          events.value.length + 1,
          status
        )
      )
  }

  function run(steps: SkillStep[]) {
    clearTimeout(timer)
    if (steps.length === 0) return
    const [step, ...remaining] = steps
    state.value = { phase: 'running', step, remaining }
    append(step)
    timer = setTimeout(completeStep, 1100)
  }

  function uploadGate(continuation: SkillStep[]) {
    if (pendingFiles.value.length)
      state.value = { phase: 'uploads', continuation }
    else run(continuation)
  }

  function selectStock() {
    const s = session.value
    if (!s) return
    s.route = 'stock'
    s.target = stockTarget({ ...s.workflow, ...s.requirements })
    uploadGate(verificationSteps('stock'))
  }

  function completeStep() {
    const current = state.value
    const s = session.value
    if (current.phase !== 'running' || !s) return
    const step = current.step
    const failed =
      (step === 'release' && s.failure === 'build') ||
      (step === 'logs' && s.failure === 'deployment')
    const last = events.value.at(-1)
    if (last) last.status = failed ? 'failed' : 'done'
    if (failed) {
      state.value = {
        phase: 'failed',
        continuation: [step, ...current.remaining]
      }
      return
    }
    if (current.remaining.length) {
      run(current.remaining)
      return
    }
    if (step === 'cloud') {
      if (s.scenario === 'lossy' && !s.request) {
        state.value = { phase: 'conversion' }
        return
      }
      if (s.scenario === 'lossless' && !s.request) {
        run(['convert'])
        return
      }
      if (stockCovers(s)) {
        selectStock()
        return
      }
      run(['existing'])
      return
    }
    if (step === 'convert') {
      selectStock()
      return
    }
    if (step === 'existing') {
      const target = existingTarget(s)
      if (target) {
        s.route = 'existing'
        s.target = target
        uploadGate(verificationSteps('existing'))
        return
      }
      s.route = 'custom'
      s.target = undefined
      run(['limits'])
      return
    }
    if (step === 'limits') {
      state.value = { phase: 'buildPlan' }
      if (s.request?.scope && s.request.region) confirmBuild(s.request)
      return
    }
    if (step === 'dryRun') {
      uploadGate(['push', 'release', 'deploy', ...verificationSteps('custom')])
      return
    }
    if (step === 'handoff') state.value = { phase: 'complete' }
  }

  function start(
    handoff: SkillHandoff,
    scenario: SkillScenario,
    environments: Environment[],
    failure: SkillSession['failure']
  ) {
    if (session.value?.id === handoff.id) return
    clearTimeout(timer)
    session.value = {
      ...snapshotHandoff(handoff),
      scenario,
      environments: snapshotEnvironments(environments),
      requirements: {
        packs: [...handoff.workflow.packs],
        models: [
          ...new Set([
            ...handoff.workflow.models,
            ...(['custom', 'lossy'].includes(scenario)
              ? ['acme_hero_lora_v5.safetensors']
              : [])
          ])
        ]
      },
      route: 'stock',
      lossyApproved: false,
      failure,
      repairs: 0
    }
    approvedFiles.value = []
    events.value = []
    run(['skill', 'locate', 'inventory', 'cloud'])
  }

  function chooseConversion(approved: boolean) {
    if (state.value.phase !== 'conversion' || !session.value) return
    session.value.lossyApproved = approved
    if (approved)
      session.value.requirements.models =
        session.value.requirements.models.filter(
          (model) => model !== 'acme_hero_lora_v5.safetensors'
        )
    append('conversionApproved', 'done')
    run(approved ? ['convert'] : ['existing'])
  }

  function confirmBuild(request: DesktopBuildRequest) {
    if (
      state.value.phase !== 'buildPlan' ||
      !session.value ||
      !request.name.trim() ||
      !request.gpu.trim() ||
      !request.region?.trim()
    )
      return
    const source = updateSource(session.value, request)
    if (request.mode === 'update' && !source) return
    session.value.request =
      request.mode === 'update' && source
        ? {
            ...request,
            sourceId: source.buildId ?? source.id,
            sourceEnvironmentId: source.id
          }
        : { ...request }
    session.value.target = plannedTarget(
      session.value,
      session.value.request,
      source
    )
    append('planApproved', 'done')
    run(['manifest', 'dryRun'])
  }

  function approveUploads(kind: UploadKind) {
    const current = state.value
    if (current.phase !== 'uploads') return
    const files = pendingFiles.value.filter((file) => file.kind === kind)
    if (!files.length) return
    approvedFiles.value = [
      ...approvedFiles.value,
      ...files.map((file) => file.name)
    ]
    if (!pendingFiles.value.length) run(['uploads', ...current.continuation])
  }

  function declineUploads() {
    if (state.value.phase === 'uploads')
      state.value = { phase: 'blocked', continuation: state.value.continuation }
  }

  function reviewUploads() {
    if (state.value.phase === 'blocked')
      state.value = { phase: 'uploads', continuation: state.value.continuation }
  }

  function retry() {
    if (
      state.value.phase !== 'failed' ||
      !session.value ||
      session.value.repairs >= 3
    )
      return
    session.value.repairs++
    session.value.failure = 'none'
    if (session.value.route === 'existing') {
      const failedId = session.value.target?.id
      const failed = session.value.environments.find(
        (env) => env.id === failedId
      )
      if (failed) failed.verified = false
      run(['repair', 'existing'])
    } else run(['repair', 'dryRun'])
  }

  return {
    state,
    session,
    events,
    approvedFiles,
    pendingFiles,
    start,
    chooseConversion,
    confirmBuild,
    approveUploads,
    declineUploads,
    reviewUploads,
    retry
  }
})
