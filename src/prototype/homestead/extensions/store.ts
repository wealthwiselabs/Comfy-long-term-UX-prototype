import { defineStore } from 'pinia'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { computed, onScopeDispose, ref, toRaw } from 'vue'
import { useHomesteadStore } from '../store'
import {
  canRun,
  firstEnvironmentState,
  initialState,
  suggestedGpu,
  transition
} from './model'
import type { ExtensionEvent, ExtensionEnvironment } from './model'
import type { Environment, Workflow } from '../model'
import { demoWorkflowGraph } from '../../fixtures/demoWorkflowGraphs'
import { preparationStages } from './preparation'
import {
  catalogGpu,
  normalizeModels,
  environmentPackageStorage,
  storageCatalogFixture
} from './catalog'

export const useExtensionManagerStore = defineStore(
  'extension-manager-prototype',
  () => {
    const enabled = computed(
      () =>
        new URLSearchParams(window.location.search).get('flow') === 'extensions'
    )
    const homestead = useHomesteadStore()
    const initiatingWorkflowId = ref<string | null>(null)
    const state = ref(initialState())
    const excludedVersions = ref<Record<string, string>>({})
    let cleanDraftSnapshot = ''
    const preparationStep = ref(-1)
    const panel = ref<
      'intro' | 'packs' | 'models' | 'review' | 'status' | null
    >('packs')
    const introAccepted = ref(false)
    const scenario = ref<'existing' | 'first' | 'member'>('existing')
    const enterpriseCapabilities = ref({ addNodes: true, addModels: true })
    const canAddNodes = computed(
      () => scenario.value !== 'member' || enterpriseCapabilities.value.addNodes
    )
    const canAddModels = computed(
      () =>
        scenario.value !== 'member' || enterpriseCapabilities.value.addModels
    )
    const canManageExtensions = computed(
      () => canAddNodes.value || canAddModels.value
    )
    const selectionSteps = computed(() => {
      const steps: ('packs' | 'models')[] = []
      if (canAddNodes.value) steps.push('packs')
      if (canAddModels.value) steps.push('models')
      return steps
    })
    const firstSetup = computed(
      () =>
        state.value.targetId === 'dep-comfy-cloud' &&
        state.value.phase !== 'updated'
    )
    const gpuSuggestion = computed(() =>
      catalogGpu(suggestedGpu(state.value.draft.models))
    )
    const selectedGpu = computed(() => catalogGpu(state.value.draft.gpu))
    const workflowModelIds = ref<string[]>([])
    const packageStorage = computed(() =>
      environmentPackageStorage(
        state.value.draft.models,
        state.value.draft.packs,
        storageCatalogFixture.pricePerGbMonthUsd
      )
    )
    const role = ref<'admin' | 'member'>('admin')
    const requestNote = ref('')
    const failure = ref(false)
    const holdJobs = ref(false)
    const inbox = ref<
      {
        title: string
        recipients: string
        kind: 'request' | 'ready' | 'failed' | 'available'
        note?: string
      }[]
    >([])
    const requestPending = ref(false)
    const target = computed(
      () => state.value.environments[state.value.targetId]
    )
    const changes = computed(() =>
      [
        ...new Set([
          ...Object.keys(target.value.packs),
          ...Object.keys(state.value.draft.packs)
        ])
      ].filter((id) => target.value.packs[id] !== state.value.draft.packs[id])
    )
    function extensionEnvironment(
      environment: Environment
    ): ExtensionEnvironment {
      return (
        state.value.environments[environment.id] ?? {
          ...environment,
          revision: Number(environment.revision.replace(/\D/g, '')) || 1,
          packs: Object.fromEntries(environment.packs.map((id) => [id, 'demo']))
        }
      )
    }
    const selectedEnvironment = computed(() =>
      extensionEnvironment(homestead.environment)
    )
    const availableEnvironments = computed(() => {
      const managed = Object.values(state.value.environments)
      const cloud = homestead.availableEnvironments.find(
        (environment) => environment.id === 'dep-comfy-cloud'
      )
      return cloud &&
        !managed.some((environment) => environment.id === cloud.id)
        ? [extensionEnvironment(cloud), ...managed]
        : managed
    })
    const needsIntro = computed(
      () =>
        !introAccepted.value &&
        !availableEnvironments.value.some(
          (environment) => environment.id !== 'dep-comfy-cloud'
        )
    )
    function continueFromIntro() {
      if (!editable.value) return
      introAccepted.value = true
      panel.value = selectionSteps.value[0] ?? null
    }
    function selectEnvironment(id: string) {
      if (state.value.phase === 'applying') return false
      const environment = availableEnvironments.value.find(
        (item) => item.id === id
      )
      if (!environment || homestead.environment.id === id) return false
      homestead.active.environmentId = id
      state.value.sessions.you = id
      homestead.runtime = 'ready'
      if (
        state.value.phase === 'idle' &&
        !requestPending.value &&
        draftSnapshot() === cleanDraftSnapshot
      )
        retargetDraft(environment)
      useToastStore().add({
        severity: 'success',
        summary: t('extensionPrototype.environmentSwitched', {
          name: environment.name
        }),
        life: 3000
      })
      return true
    }
    const locked = computed(
      () => !canRun(state.value, homestead.environment.id)
    )
    const editable = computed(() =>
      ['idle', 'failed', 'updated'].includes(state.value.phase)
    )
    const timers = new Set<ReturnType<typeof setTimeout>>()
    function later(action: () => void, ms: number) {
      const timer = setTimeout(() => {
        timers.delete(timer)
        action()
      }, ms)
      timers.add(timer)
    }
    onScopeDispose(() => timers.forEach(clearTimeout))
    function syncEnvironment(workflowId?: string) {
      const environments = Object.values(state.value.environments).map(
        (environment) => ({
          ...environment,
          revision: `v${environment.revision}`,
          packs: Object.keys(environment.packs),
          verified: true
        })
      )
      homestead.availableEnvironments = [
        ...homestead.availableEnvironments.filter(
          (environment) =>
            !environments.some((item) => item.id === environment.id)
        ),
        ...environments
      ]
      const workflow = homestead.workflows.find(
        (item) => item.id === workflowId
      )
      if (workflow) workflow.environmentId = state.value.sessions.you
      homestead.runtime = 'ready'
    }
    function dispatch(event: ExtensionEvent) {
      const previous = state.value.phase
      state.value = transition(toRaw(state.value), event)
      if (state.value.phase === previous) return
      if (state.value.phase === 'ready' || state.value.phase === 'failed') {
        inbox.value.push({
          title: target.value.name,
          recipients: 'initiator@studio.example',
          kind: state.value.phase
        })
      }
      if (state.value.phase === 'applying')
        later(() => dispatch({ type: 'apply' }), 1600)
      if (state.value.phase === 'updated') {
        introAccepted.value = true
        const appliedId =
          state.value.draft.mode === 'new'
            ? state.value.sessions.you
            : state.value.targetId
        const applied = state.value.environments[appliedId]
        syncEnvironment(
          state.value.draft.mode === 'new'
            ? (initiatingWorkflowId.value ?? undefined)
            : undefined
        )
        if (state.value.targetId === 'dep-comfy-cloud')
          scenario.value = 'existing'
        if (requestPending.value) {
          inbox.value.push({
            title: applied.name,
            recipients: 'requester@studio.example',
            kind: 'available'
          })
          requestPending.value = false
        }
        useToastStore().add({
          severity: 'success',
          summary: t(
            homestead.environment.id === appliedId
              ? 'extensionPrototype.environmentSwitched'
              : 'extensionPrototype.environmentApplied',
            { name: applied.name }
          ),
          life: 3000
        })
        panel.value = null
      }
    }
    function initialize() {
      if (
        new URLSearchParams(window.location.search).get('scenario') === 'first'
      )
        reset('first')
      else {
        seedModelDefaults()
        syncEnvironment(homestead.activeId)
        cleanDraftSnapshot = draftSnapshot()
      }
    }
    function prepare() {
      if (
        role.value !== 'admin' ||
        !editable.value ||
        !selectedGpu.value ||
        !canManageExtensions.value
      )
        return
      restrictDraft()
      if (state.value.phase !== 'failed')
        initiatingWorkflowId.value = homestead.activeId
      if (firstSetup.value) state.value.draft.mode = 'new'
      dispatch({ type: 'prepare' })
      panel.value = 'status'
      const generation = state.value.generation
      const willFail = failure.value
      preparationStep.value = 0
      preparationStages.forEach((_, index) => {
        if (index === 0 || (willFail && index > 1)) return
        later(() => {
          if (
            state.value.generation === generation &&
            state.value.phase === 'preparing'
          )
            preparationStep.value = index
        }, index * 750)
      })
      later(() => {
        if (
          state.value.generation === generation &&
          state.value.phase === 'preparing'
        )
          dispatch({ type: willFail ? 'fail' : 'ready' })
      }, 5500)
    }
    function run(environmentId = homestead.environment.id) {
      const native = homestead.availableEnvironments.find(
        (item) => item.id === environmentId
      )
      if (native && !Object.hasOwn(state.value.environments, environmentId))
        state.value.environments[environmentId] = extensionEnvironment(native)
      const before = state.value.jobs.length
      dispatch({ type: 'run', environmentId })
      if (before === state.value.jobs.length) {
        panel.value = 'status'
        return false
      }
      if (state.value.jobs.at(-1)?.status === 'running') later(finishNext, 7000)
      return true
    }
    function finishNext() {
      if (holdJobs.value) return
      dispatch({ type: 'finishJob' })
      if (state.value.jobs.some((job) => job.status === 'running'))
        later(finishNext, 7000)
    }
    function edit() {
      if (!editable.value || !canManageExtensions.value) return
      if (state.value.phase === 'updated') {
        const id =
          state.value.targetId === 'dep-comfy-cloud' &&
          state.value.draft.mode === 'new'
            ? state.value.sessions.you
            : homestead.environment.id
        const environment =
          state.value.environments[id] ??
          extensionEnvironment(homestead.environment)
        retargetDraft(environment)
      } else if (
        state.value.phase === 'idle' &&
        !requestPending.value &&
        state.value.targetId !== homestead.environment.id &&
        draftSnapshot() === cleanDraftSnapshot
      ) {
        retargetDraft(selectedEnvironment.value)
      }
      panel.value = needsIntro.value
        ? 'intro'
        : (selectionSteps.value[0] ?? null)
    }
    function draftSnapshot() {
      const draft = state.value.draft
      return JSON.stringify({
        name: draft.name,
        mode: draft.mode,
        gpu: draft.gpu,
        requestNote: requestNote.value,
        models: normalizeModels(draft.models).sort(),
        packs: Object.entries(draft.packs).sort(([left], [right]) =>
          left.localeCompare(right)
        ),
        excludedVersions: Object.entries(excludedVersions.value).sort(
          ([left], [right]) => left.localeCompare(right)
        )
      })
    }
    function retargetDraft(environment: ExtensionEnvironment) {
      state.value.environments[environment.id] = {
        ...environment,
        packs: { ...environment.packs },
        models: [...environment.models]
      }
      state.value.targetId = environment.id
      state.value.sessions.you = environment.id
      state.value.draft =
        environment.id === 'dep-comfy-cloud'
          ? firstEnvironmentState(workflowModels(homestead.active)).draft
          : {
              name: environment.name,
              gpu: environment.gpu,
              models: [...environment.models],
              packs: { ...environment.packs },
              mode: 'update'
            }
      excludedVersions.value = {}
      requestNote.value = ''
      seedModelDefaults()
      state.value.phase = 'idle'
      cleanDraftSnapshot = draftSnapshot()
    }
    function workflowModels(workflow: Workflow) {
      if (workflow.models.length) return [...workflow.models]
      return [
        ...new Set(
          demoWorkflowGraph(workflow)
            .nodes.flatMap((node) => node.widgets_values ?? [])
            .filter(
              (value): value is string =>
                typeof value === 'string' &&
                /\.(safetensors|ckpt|gguf)$/i.test(value)
            )
        )
      ]
    }
    function seedModelDefaults() {
      workflowModelIds.value = normalizeModels(workflowModels(homestead.active))
      state.value.draft.models = canAddModels.value
        ? normalizeModels([
            ...state.value.draft.models,
            ...workflowModelIds.value
          ])
        : [...target.value.models]
    }
    function restrictDraft() {
      if (!canAddNodes.value) {
        state.value.draft.packs = { ...target.value.packs }
        excludedVersions.value = {}
      }
      if (!canAddModels.value)
        state.value.draft.models = [...target.value.models]
    }
    function setEnterpriseCapabilities(capabilities: {
      addNodes: boolean
      addModels: boolean
    }) {
      enterpriseCapabilities.value = { ...capabilities }
      restrictDraft()
      if (!canManageExtensions.value) panel.value = null
      else if (
        (panel.value === 'packs' && !canAddNodes.value) ||
        (panel.value === 'models' && !canAddModels.value)
      )
        panel.value = selectionSteps.value[0] ?? null
    }
    function reset(next: typeof scenario.value) {
      timers.forEach(clearTimeout)
      timers.clear()
      introAccepted.value = false
      enterpriseCapabilities.value = { addNodes: true, addModels: true }
      preparationStep.value = -1
      state.value =
        next === 'first'
          ? firstEnvironmentState(workflowModels(homestead.active))
          : initialState()
      seedModelDefaults()
      excludedVersions.value = {}
      scenario.value = next
      role.value = next === 'member' ? 'member' : 'admin'
      inbox.value = []
      requestNote.value = ''
      requestPending.value = false
      failure.value = false
      holdJobs.value = false
      syncEnvironment(homestead.activeId)
      cleanDraftSnapshot = draftSnapshot()
      panel.value = needsIntro.value ? 'intro' : 'packs'
    }
    function request() {
      if (!canManageExtensions.value) return
      restrictDraft()
      requestNote.value = requestNote.value.trim()
      requestPending.value = true
      inbox.value.push({
        title: target.value.name,
        recipients:
          'alex@studio.example, sam@studio.example (all workspace admins)',
        kind: 'request',
        note: requestNote.value
      })
      panel.value = null
      useToastStore().add({
        severity: 'success',
        summary: t('extensionPrototype.requestEmailSent'),
        life: 5000
      })
    }
    function reviewRequest() {
      role.value = 'admin'
      panel.value = 'review'
    }
    const repairContext = computed(() =>
      JSON.stringify(
        {
          simulation: true,
          error:
            'Dependency resolution failed: selected private pack requires a conflicting torch version.',
          environment: target.value.name,
          workingRevision: target.value.revision,
          requested: state.value.draft,
          instruction:
            'Diagnose locally in Codex or Claude. Review fixes, then edit selections and retry in Cloud. No integrated repair or remote changes.'
        },
        null,
        2
      )
    )
    seedModelDefaults()
    cleanDraftSnapshot = draftSnapshot()
    return {
      enabled,
      state,
      excludedVersions,
      preparationStep,
      panel,
      scenario,
      enterpriseCapabilities,
      canAddNodes,
      canAddModels,
      canManageExtensions,
      selectionSteps,
      setEnterpriseCapabilities,
      firstSetup,
      continueFromIntro,
      gpuSuggestion,
      selectedGpu,
      workflowModelIds,
      packageStorage,
      role,
      requestNote,
      failure,
      holdJobs,
      inbox,
      requestPending,
      target,
      changes,
      selectedEnvironment,
      availableEnvironments,
      selectEnvironment,
      locked,
      editable,
      initialize,
      dispatch,
      prepare,
      run,
      finishNext,
      edit,
      reset,
      request,
      reviewRequest,
      repairContext
    }
  }
)
