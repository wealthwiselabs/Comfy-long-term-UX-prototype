import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, toRaw } from 'vue'
import { useHomesteadStore } from '../store'
import { canRun, initialState, transition } from './model'
import type { ExtensionEvent, ExtensionEnvironment } from './model'
import type { Environment } from '../model'

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
    const panel = ref<'packs' | 'review' | 'status' | null>('packs')
    const scenario = ref<'existing' | 'first' | 'member'>('existing')
    const role = ref<'admin' | 'member'>('admin')
    const failure = ref(false)
    const holdJobs = ref(false)
    const inbox = ref<
      {
        title: string
        recipients: string
        kind: 'request' | 'ready' | 'failed' | 'available'
      }[]
    >([])
    const requestPending = ref(false)
    const target = computed(
      () => state.value.environments[state.value.targetId]
    )
    function extensionEnvironment(
      environment: Environment
    ): ExtensionEnvironment {
      return (
        state.value.environments[environment.id] ?? {
          ...environment,
          revision: Number(environment.revision.replace(/\D/g, '')) || 1,
          packs: Object.fromEntries(
            environment.packs.map((id) => [id, 'demo'])
          ),
          storage: 48
        }
      )
    }
    const selectedEnvironment = computed(() =>
      extensionEnvironment(homestead.environment)
    )
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
      if (workflow)
        workflow.environmentId =
          scenario.value === 'first'
            ? 'dep-comfy-cloud'
            : state.value.sessions.you
      homestead.runtime = 'ready'
    }
    function dispatch(event: ExtensionEvent) {
      const previous = state.value.phase
      state.value = transition(state.value, event)
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
        syncEnvironment(
          state.value.draft.mode === 'new'
            ? (initiatingWorkflowId.value ?? undefined)
            : undefined
        )
        if (requestPending.value) {
          inbox.value.push({
            title: state.value.environments[state.value.sessions.you].name,
            recipients: 'requester@studio.example',
            kind: 'available'
          })
          requestPending.value = false
        }
      }
    }
    function initialize() {
      syncEnvironment(homestead.activeId)
    }
    function prepare() {
      if (role.value !== 'admin' || !editable.value) return
      if (state.value.phase !== 'failed')
        initiatingWorkflowId.value = homestead.activeId
      dispatch({ type: 'prepare' })
      panel.value = 'status'
      const generation = state.value.generation
      later(() => {
        if (
          state.value.generation === generation &&
          state.value.phase === 'preparing'
        )
          dispatch({ type: failure.value ? 'fail' : 'ready' })
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
      if (!editable.value) return
      if (state.value.phase === 'updated') {
        state.value.environments[homestead.environment.id] =
          extensionEnvironment(homestead.environment)
        state.value.targetId = homestead.environment.id
        state.value.sessions.you = homestead.environment.id
        state.value.draft = {
          ...structuredClone(toRaw(selectedEnvironment.value)),
          mode: 'update'
        }
        state.value.phase = 'idle'
      }
      panel.value = 'packs'
    }
    function reset(next: typeof scenario.value) {
      timers.forEach(clearTimeout)
      timers.clear()
      state.value = initialState()
      scenario.value = next
      role.value = next === 'member' ? 'member' : 'admin'
      inbox.value = []
      requestPending.value = false
      failure.value = false
      holdJobs.value = false
      panel.value = 'packs'
      syncEnvironment(homestead.activeId)
    }
    function request() {
      requestPending.value = true
      inbox.value.push({
        title: target.value.name,
        recipients:
          'alex@studio.example, sam@studio.example (all workspace admins)',
        kind: 'request'
      })
      panel.value = null
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
    return {
      enabled,
      state,
      panel,
      scenario,
      role,
      failure,
      holdJobs,
      inbox,
      requestPending,
      target,
      selectedEnvironment,
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
