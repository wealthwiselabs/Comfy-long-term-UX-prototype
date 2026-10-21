<script setup lang="ts">
import { computed, onScopeDispose, ref, toRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { COMFY_CLOUD } from '../fixtures/customCloud'
import type { DesktopBuildRequest } from './agentModel'
import { compatibility } from './model'
import type { Environment } from './model'
import HomesteadAgentChoices from './HomesteadAgentChoices.vue'
import { useHomesteadStore } from './store'
const s = useHomesteadStore()
const { t } = useI18n()
const pending = ref<DesktopBuildRequest | null>(null)
const cancelled = ref(false)
const verification = ref<'idle' | 'testing' | 'ready'>('idle')
let verificationTimer: ReturnType<typeof setTimeout> | undefined
onScopeDispose(() => clearTimeout(verificationTimer))
const stock: Environment = {
  id: COMFY_CLOUD.id,
  name: COMFY_CLOUD.name,
  revision: COMFY_CLOUD.release ?? 'v1',
  gpu: 'Comfy Cloud',
  packs: [...COMFY_CLOUD.nodePacks],
  models: [...COMFY_CLOUD.models],
  verified: true
}
const candidate = computed(() => {
  const workflow = s.agentHandoff?.workflow
  if (!workflow) return undefined
  if (s.agentHandoff?.request) return undefined
  const choices = [stock, ...s.availableEnvironments]
  return choices.find(
    (env) => compatibility(workflow, env).status === 'compatible'
  )
})
const needsUpload = s.importCase === 'missing'
function confirm(request: DesktopBuildRequest) {
  pending.value = request
  if (!needsUpload) proceed()
}
function proceed() {
  const handoff = s.agentHandoff
  if (!handoff) return
  if (candidate.value) {
    verification.value = 'testing'
    verificationTimer = setTimeout(() => {
      verification.value = 'ready'
    }, 3000)
    return
  }
  if (pending.value) s.startBuild('agent', pending.value, handoff.workflow)
}
function openReused() {
  const handoff = s.agentHandoff
  const target = candidate.value
  if (!handoff || !target || verification.value !== 'ready') return
  if (!s.availableEnvironments.some((env) => env.id === target.id))
    s.availableEnvironments.push(target)
  const copy = structuredClone(toRaw(handoff.workflow))
  copy.id = `cloud-${crypto.randomUUID()}`
  copy.environmentId = target.id
  copy.saved = true
  s.workflows.push(copy)
  s.activeId = copy.id
  s.switchEnvironment(target.id, true)
  s.save()
  s.agentHandoff = null
  s.agentOpen = false
  s.openWorkflow(copy.id)
}
function reuse() {
  if (!needsUpload) proceed()
  else pending.value = { mode: 'create', name: '', gpu: '', instructions: '' }
}
</script>
<template>
  <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
    <p
      class="text-xs text-muted-foreground"
      :title="t('homestead.agentSimulationHint')"
    >
      {{ t('homestead.agentSimulation') }}
    </p>
    <p class="rounded-xl bg-secondary-background p-3 text-sm">
      {{ s.agentHandoff?.workflow.name }}
    </p>
    <p class="text-sm leading-6">{{ t('homestead.agentRouteCheck') }}</p>
    <section v-if="verification !== 'idle'" class="space-y-4">
      <p role="status" class="text-sm leading-6">
        {{
          t(
            verification === 'testing'
              ? 'homestead.reuseTesting'
              : 'homestead.reuseVerified'
          )
        }}
      </p>
      <Button
        v-if="verification === 'ready'"
        variant="inverted"
        @click="openReused"
        >{{ t('homestead.openCloud') }}</Button
      >
    </section>
    <template v-else-if="candidate && !pending">
      <p class="text-sm leading-6">
        {{
          t('homestead.reuseEnvironment', {
            name: candidate.name,
            revision: candidate.revision
          })
        }}
      </p>
      <Button variant="inverted" @click="reuse">{{
        t('homestead.useEnvironment')
      }}</Button>
    </template>
    <template v-else-if="!pending">
      <p class="text-sm leading-6 text-muted-foreground">
        {{ t('homestead.agentNeedsBuild') }}
      </p>
      <HomesteadAgentChoices @confirm="confirm" />
    </template>
    <section
      v-if="pending && needsUpload && verification === 'idle'"
      class="space-y-4 rounded-xl border border-border-subtle p-4"
    >
      <h3 class="text-sm font-medium">
        {{ t('homestead.uploadAssetsTitle') }}
      </h3>
      <p class="text-xs leading-5 text-muted-foreground">
        {{ t('homestead.uploadDemo') }}
      </p>
      <p class="text-sm leading-6">{{ t('homestead.uploadDemoFile') }}</p>
      <p class="text-xs leading-5 text-muted-foreground">
        {{
          t('homestead.uploadDisclosure', {
            workspace: s.agentHandoff?.workspace
          })
        }}
      </p>
      <p v-if="cancelled" role="alert" class="text-sm text-gold-400">
        {{ t('homestead.uploadBlocked') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button variant="secondary" @click="cancelled = true">{{
          t('homestead.cancelUpload')
        }}</Button>
        <Button variant="inverted" @click="proceed">{{
          t('homestead.uploadAssets')
        }}</Button>
      </div>
    </section>
  </div>
</template>
