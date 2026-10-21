<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import HomesteadAgentChoices from './HomesteadAgentChoices.vue'
import HomesteadSkillUploads from './HomesteadSkillUploads.vue'
import { useSkillFlowStore } from './skillFlowStore'
import { useHomesteadStore } from './store'
import { skillCommand } from './skillFlowSteps'
const s = useHomesteadStore()
const flow = useSkillFlowStore()
const { t } = useI18n()
const scroller = ref<HTMLElement | null>(null)
const following = ref(true)
const running = computed(() => flow.state.phase === 'running')
watch(
  () => s.agentHandoff,
  (handoff) => {
    if (handoff)
      flow.start(handoff, s.agentScenario, s.availableEnvironments, s.failure)
  },
  { immediate: true }
)
watch(
  () => [flow.events.length, flow.state.phase],
  async () => {
    if (!following.value) return
    await nextTick()
    scroller.value?.scrollTo({
      top: scroller.value.scrollHeight,
      behavior: 'smooth'
    })
  }
)
function onScroll() {
  const el = scroller.value
  if (el)
    following.value = el.scrollHeight - el.scrollTop - el.clientHeight < 100
}
function preview() {
  const session = flow.session
  if (flow.state.phase !== 'complete' || !session?.target) return
  if (!s.availableEnvironments.some((env) => env.id === session.target?.id))
    s.availableEnvironments.push(structuredClone(toRaw(session.target)))
  const copy = structuredClone(toRaw(session.workflow))
  copy.id = `cloud-${crypto.randomUUID()}`
  copy.environmentId = session.target.id
  copy.saved = true
  s.workflows.push(copy)
  s.activeId = copy.id
  s.switchEnvironment(session.target.id, true)
  s.save()
  s.agentHandoff = null
  s.agentOpen = false
  s.openWorkflow(copy.id)
}
</script>
<template>
  <div
    ref="scroller"
    class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5"
    @scroll="onScroll"
  >
    <p class="text-xs text-muted-foreground">
      {{ t('homestead.skillFlow.simulated') }}
    </p>
    <section
      class="ml-5 space-y-1 rounded-xl bg-secondary-background px-4 py-3"
    >
      <p class="text-xs text-muted-foreground">{{ t('homestead.you') }}</p>
      <p class="text-sm leading-6">
        {{
          t('homestead.skillFlow.request', {
            name: flow.session?.workflow.name
          })
        }}
      </p>
    </section>
    <div class="flex items-start gap-3">
      <i class="mt-1 icon-[lucide--sparkles] size-4 shrink-0" />
      <p class="text-sm leading-6">{{ t('homestead.skillFlow.intro') }}</p>
    </div>
    <ol class="space-y-2" :aria-label="t('homestead.skillFlow.progress')">
      <li v-for="activity in flow.events" :key="activity.id">
        <details
          :open="activity.status !== 'done'"
          class="rounded-lg border border-border-subtle"
        >
          <summary
            class="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-xs"
          >
            <i
              :class="
                cn(
                  'size-3.5 shrink-0',
                  activity.status === 'running'
                    ? 'icon-[lucide--loader-circle] animate-spin motion-reduce:animate-none'
                    : activity.status === 'failed'
                      ? 'icon-[lucide--circle-alert] text-gold-400'
                      : 'icon-[lucide--check] text-muted-foreground'
                )
              "
            />
            <span class="flex-1 font-medium">{{
              t(`homestead.skillFlow.steps.${activity.step}`)
            }}</span>
            <span class="text-muted-foreground">{{
              t(`homestead.skillFlow.status.${activity.status}`)
            }}</span>
          </summary>
          <div class="space-y-3 border-t border-border-subtle px-3 py-3">
            <code
              v-if="activity.command"
              class="block text-xs leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
              >{{ activity.command }}</code
            >
            <p
              v-if="activity.status !== 'running'"
              class="text-xs leading-5 whitespace-pre-line"
            >
              {{
                t(
                  activity.status === 'failed'
                    ? 'homestead.skillFlow.failureLog'
                    : `homestead.skillFlow.details.${activity.detail}`,
                  activity.values
                )
              }}
            </p>
          </div>
        </details>
      </li>
    </ol>
    <p v-if="running" role="status" class="text-xs text-muted-foreground">
      {{ t('homestead.agentWorking') }}
    </p>
    <section
      v-if="flow.state.phase === 'conversion'"
      class="space-y-4 rounded-xl border border-border-subtle p-4"
    >
      <h3 class="text-sm font-medium">
        {{ t('homestead.skillFlow.conversionTitle') }}
      </h3>
      <p class="text-sm leading-6">
        {{ t('homestead.skillFlow.conversionBody') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button variant="inverted" @click="flow.chooseConversion(true)">{{
          t('homestead.skillFlow.convertChoice')
        }}</Button>
        <Button variant="secondary" @click="flow.chooseConversion(false)">{{
          t('homestead.skillFlow.exactChoice')
        }}</Button>
      </div>
    </section>
    <section
      v-if="flow.state.phase === 'buildPlan'"
      class="space-y-4 rounded-xl border border-border-subtle p-4"
    >
      <h3 class="text-sm font-medium">
        {{ t('homestead.skillFlow.buildTitle') }}
      </h3>
      <p class="text-sm leading-6">{{ t('homestead.skillFlow.buildBody') }}</p>
      <HomesteadAgentChoices @confirm="flow.confirmBuild" />
    </section>
    <HomesteadSkillUploads v-if="flow.state.phase === 'uploads'" />
    <section
      v-if="flow.state.phase === 'blocked'"
      class="space-y-3 rounded-xl border border-gold-400/30 p-4"
    >
      <p role="alert" class="text-sm leading-6">
        {{ t('homestead.skillFlow.blocked') }}
      </p>
      <Button variant="secondary" @click="flow.reviewUploads">{{
        t('homestead.skillFlow.reviewUploads')
      }}</Button>
    </section>
    <section
      v-if="flow.state.phase === 'failed'"
      class="space-y-3 rounded-xl border border-gold-400/30 p-4"
    >
      <p role="alert" class="text-sm leading-6">
        {{
          t('homestead.skillFlow.failureBody', {
            count: flow.session?.repairs ?? 0
          })
        }}
      </p>
      <Button
        :disabled="(flow.session?.repairs ?? 0) >= 3"
        variant="inverted"
        @click="flow.retry"
        >{{ t('homestead.skillFlow.retry') }}</Button
      >
    </section>
    <section
      v-if="flow.state.phase === 'complete'"
      class="space-y-4 border-t border-border-subtle pt-5"
    >
      <p role="status" class="text-sm font-medium">
        {{ t('homestead.skillFlow.resultTitle') }}
      </p>
      <p class="text-sm leading-6">
        {{
          t(
            flow.session?.route === 'stock'
              ? 'homestead.skillFlow.stockResult'
              : 'homestead.skillFlow.buildResult',
            {
              name: flow.session?.workflow.name,
              target: flow.session?.target?.name
            }
          )
        }}
      </p>
      <p
        v-if="flow.session?.route !== 'stock'"
        class="text-xs leading-5 text-muted-foreground"
      >
        {{ t('homestead.skillFlow.apiHandoff') }}
      </p>
      <pre
        v-if="flow.session?.route !== 'stock'"
        class="rounded-lg bg-secondary-background p-3 text-xs leading-5 wrap-anywhere whitespace-pre-wrap"
        >{{
          t('homestead.skillFlow.targetSummary', {
            build: flow.session?.target?.buildId ?? flow.session?.target?.id,
            revision: flow.session?.target?.revision,
            gpu: flow.session?.target?.gpu,
            region:
              flow.session?.request?.region ??
              t('homestead.skillFlow.existingRegion')
          })
        }}
{{ flow.session ? skillCommand('handoff', flow.session) : '' }}</pre>
      <div class="flex flex-wrap gap-2">
        <a
          :href="
            flow.session?.route === 'stock'
              ? 'https://cloud.comfy.org'
              : 'https://platform.comfy.org'
          "
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-lg border border-border-default px-3 py-2 text-xs underline underline-offset-4"
          >{{
            t(
              flow.session?.route === 'stock'
                ? 'homestead.skillFlow.openWorkflows'
                : 'homestead.openPlatform'
            )
          }}</a
        >
        <Button variant="secondary" @click="preview">{{
          t('homestead.skillFlow.openPreview')
        }}</Button>
      </div>
      <p class="text-xs leading-5 text-muted-foreground">
        {{ t('homestead.skillFlow.previewHint') }}
      </p>
    </section>
  </div>
</template>
