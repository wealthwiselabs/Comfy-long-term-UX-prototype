import { defineStore } from 'pinia'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { computed, onScopeDispose, ref, toRaw } from 'vue'
import { useHomesteadStore } from '../store'
import {
  canRun,
  firstEnvironmentState,
  initialState,
  transition
} from './model'
import type { ExtensionEvent, ExtensionEnvironment } from './model'
import type { Environment, Workflow } from '../model'
import { demoWorkflowGraph } from '../../fixtures/demoWorkflowGraphs'
import { preparationStages } from './preparation'
import type { ModelEntry } from './catalog'
import {
  isModelDirectory,
  isModelFilename,
  modelImportUrl
} from './modelImport'
import type { ModelImportInput } from './modelImport'
import {
  catalogGpu,
  cloudReadyModel,
  modelEntry,
  modelCatalogFixture,
  normalizeModels,
  recommendGpu,
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
    const selectedGpu = computed(() => catalogGpu(state.value.draft.gpu))
    const workflowModelIds = ref<string[]>([])
    const importedModels = ref<ModelEntry[]>([])
    function workflowImportedModel(id: string) {
      return importedModels.value.find(
        (entry) =>
          state.value.draft.models.includes(entry.id) &&
          entry.fileName.toLowerCase() ===
            modelEntry(id).fileName.toLowerCase() &&
          (!/[\\/]/.test(id) ||
            `${entry.directory}/${entry.fileName}`.toLowerCase() ===
              id
                .replaceAll('\\', '/')
                .replace(/^models\//, '')
                .toLowerCase())
      )
    }
    const gpuEstimate = computed(() =>
      recommendGpu(
        workflowModelIds.value.map((id) => workflowImportedModel(id)?.id ?? id),
        importedModels.value
      )
    )
    const gpuSuggestion = computed(() => gpuEstimate.value.gpu)
    const modelDetails = (id: string) =>
      cloudReadyModel(id) ?? modelEntry(id, importedModels.value)
    const modelLabel = (id: string) => {
      const entry = modelDetails(id)
      return importedModels.value.some((model) => model.id === id)
        ? `models/${entry.directory}/${entry.fileName}`
        : entry.name
    }
    const unresolvedWorkflowModels = computed(() =>
      workflowModelIds.value.filter((id) => {
        if (
          cloudReadyModel(id) ||
          normalizeModels(target.value.models).includes(modelEntry(id).id)
        )
          return false
        return !workflowImportedModel(id)
      })
    )
    function addModelImport(input: ModelImportInput): string | null {
      if (!editable.value || !canAddModels.value) return 'modelImportDisabled'
      const filename =
        input.mode === 'file' ? (input.file?.name ?? '') : input.filename.trim()
      const directory = input.directory.trim()
      if (!isModelFilename(filename)) return 'modelImportFilenameError'
      if (!isModelDirectory(directory)) return 'modelImportFolderError'
      const sourceUri =
        input.mode === 'url' ? modelImportUrl(input.url) : undefined
      if (input.mode === 'url' && !sourceUri) return 'modelImportUrlError'
      if (input.mode === 'file' && (!input.file || input.file.size <= 0))
        return 'modelImportEmptyError'
      const id = `import:${directory}/${filename}`
      if (
        [
          ...modelCatalogFixture,
          ...importedModels.value,
          ...target.value.models.map(modelDetails)
        ].some(
          (entry) =>
            entry.fileName.toLowerCase() === filename.toLowerCase() &&
            (entry.directory === undefined ||
              entry.directory.toLowerCase() === directory.toLowerCase())
        )
      )
        return 'modelImportDuplicate'
      const kind: ModelEntry['kind'] =
        directory === 'loras'
          ? 'lora'
          : directory === 'text_encoders'
            ? 'encoder'
            : directory === 'vae'
              ? 'vae'
              : ['checkpoints', 'diffusion_models'].includes(directory)
                ? 'checkpoint'
                : 'unknown'
      importedModels.value.push({
        id,
        name: filename,
        fileName: filename,
        directory,
        sourceUri: sourceUri ?? undefined,
        publisher: '',
        kind,
        aliases: [id],
        sizeBytes: input.mode === 'file' ? input.file!.size : null
      })
      state.value.draft.models = [...new Set([...state.value.draft.models, id])]
      return null
    }
    function toggleModel(id: string, on: boolean) {
      if (!editable.value || !canAddModels.value) return
      if (
        !cloudReadyModel(id) &&
        !importedModels.value.some((entry) => entry.id === id) &&
        !normalizeModels(target.value.models).includes(modelEntry(id).id)
      )
        return
      state.value.draft.models = on
        ? [...new Set([...state.value.draft.models, id])]
        : state.value.draft.models.filter((value) => value !== id)
    }
    const packageStorage = computed(() =>
      environmentPackageStorage(
        state.value.draft.models,
        state.value.draft.packs,
        storageCatalogFixture.pricePerGbMonthUsd,
        importedModels.value
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
    const updateEnvironments = computed(() =>
      availableEnvironments.value
        .filter((environment) => environment.id !== 'dep-comfy-cloud')
        .sort(
          (left, right) =>
            Number(right.id === selectedEnvironment.value.id) -
            Number(left.id === selectedEnvironment.value.id)
        )
    )
    function chooseUpdateEnvironment(id: string) {
      if (!editable.value || role.value !== 'admin') return
      const environment = updateEnvironments.value.find(
        (item) => item.id === id
      )
      if (!environment) return
      const previous = target.value
      const draft = state.value.draft
      const packs = { ...environment.packs }
      for (const packId of changes.value) {
        if (draft.packs[packId]) packs[packId] = draft.packs[packId]
        else delete packs[packId]
      }
      const previousModels = normalizeModels(previous.models)
      const draftModels = normalizeModels(draft.models)
      const removedModels = previousModels.filter(
        (model) => !draftModels.includes(model)
      )
      const addedModels = draftModels.filter(
        (model) => !previousModels.includes(model)
      )
      const workflowDefaults = normalizeModels(workflowModelIds.value).filter(
        (model) => draftModels.includes(model)
      )
      state.value.targetId = id
      state.value.draft = {
        ...draft,
        mode: 'update',
        name: environment.name,
        gpu: draft.gpu === previous.gpu ? environment.gpu : draft.gpu,
        packs,
        models: normalizeModels([
          ...environment.models.filter(
            (model) => !removedModels.includes(modelEntry(model).id)
          ),
          ...addedModels,
          ...workflowDefaults
        ])
      }
      state.value.phase = 'idle'
    }
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
        targetId: state.value.targetId,
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
      workflowModelIds.value = [
        ...new Set(
          workflowModels(homestead.active)
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ]
      state.value.draft.models = canAddModels.value
        ? normalizeModels([
            ...state.value.draft.models,
            ...workflowModelIds.value.flatMap((value) => {
              const entry = cloudReadyModel(value)
              return entry ? [entry.id] : []
            })
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
      importedModels.value = []
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
      gpuEstimate,
      selectedGpu,
      workflowModelIds,
      importedModels,
      modelDetails,
      modelLabel,
      unresolvedWorkflowModels,
      addModelImport,
      toggleModel,
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
      updateEnvironments,
      chooseUpdateEnvironment,
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
