<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { modelEntry } from './catalog'
import { useExtensionManagerStore } from './store'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import PackCatalog from './PackCatalog.vue'
import ExtensionReview from './ExtensionReview.vue'
import ModelCatalog from './ModelCatalog.vue'
import PreparationStatus from './PreparationStatus.vue'
import FirstEnvironmentIntro from './FirstEnvironmentIntro.vue'
import RequestSummary from './RequestSummary.vue'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const { copy, copied } = useClipboard()
const name = (id: string) =>
  policyCatalog.find((pack) => pack.id === id)?.name ?? id
const pendingJobs = computed(() =>
  s.state.jobs.filter(
    (job) =>
      job.environmentId === s.state.targetId && job.status !== 'completed'
  )
)
const phaseKey = computed(
  () => s.state.phase[0].toUpperCase() + s.state.phase.slice(1)
)
let returnFocus: HTMLElement | null = null
function captureReturnFocus() {
  returnFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
}
function restoreFocus() {
  const opener = document.querySelector<HTMLButtonElement>(
    '[data-testid="extension-manager-open"]'
  )
  const target =
    returnFocus?.isConnected && returnFocus !== document.body
      ? returnFocus
      : opener
  target?.focus()
}
const managerOpen = computed({
  get: () => s.panel !== null && s.panel !== 'status',
  set: (open) => {
    if (!open && s.panel !== 'status') s.panel = null
  }
})
const flowSteps = computed<('packs' | 'models' | 'review')[]>(() =>
  s.role === 'member' ? s.selectionSteps : [...s.selectionSteps, 'review']
)
const stepIndex = computed(() =>
  flowSteps.value.findIndex((step) => step === s.panel)
)
const requestStep = computed(
  () => s.role === 'member' && s.panel === s.selectionSteps.at(-1)
)
function continueFlow() {
  if (requestStep.value) s.request()
  else if (s.panel === 'review') s.prepare()
  else s.panel = flowSteps.value[stepIndex.value + 1] ?? null
}
</script>
<template>
  <Dialog v-model:open="managerOpen"
    ><DialogPortal
      ><DialogOverlay /><DialogContent
        :size="s.panel === 'intro' ? 'md' : 'xl'"
        :class="
          cn(
            'overflow-hidden',
            s.panel !== 'intro' && 'h-[min(85vh,50rem)] sm:max-w-6xl'
          )
        "
        @open-auto-focus="captureReturnFocus"
        @close-auto-focus.prevent="restoreFocus"
      >
        <DialogHeader
          class="shrink-0 flex-col items-stretch gap-2 border-b border-border-subtle px-6 pt-5 pb-4"
          ><div class="flex items-center justify-between gap-3">
            <DialogTitle class="m-0">{{
              text(
                s.panel === 'intro'
                  ? 'introTitle'
                  : s.panel === 'review'
                    ? 'review'
                    : s.panel === 'models'
                      ? 'modelStep'
                      : 'packs'
              )
            }}</DialogTitle
            ><DialogClose
              ><Button
                size="icon-sm"
                variant="muted-textonly"
                :aria-label="text('close')"
                ><i class="icon-[lucide--x] size-4" /></Button
            ></DialogClose>
          </div>
          <DialogDescription
            :class="cn('m-0', s.panel === 'intro' && 'sr-only')"
            >{{
              s.panel === 'intro'
                ? text('introDescription')
                : s.panel === 'packs' && s.firstSetup
                  ? text('firstBody')
                  : text('stepDescription', {
                      step: stepIndex + 1,
                      total: flowSteps.length,
                      name: s.target.name
                    })
            }}</DialogDescription
          ></DialogHeader
        >
        <FirstEnvironmentIntro v-if="s.panel === 'intro'" />
        <div
          v-else-if="s.panel === 'packs' || s.panel === 'models'"
          class="flex min-h-0 flex-1 flex-col overflow-auto"
        >
          <PackCatalog v-if="s.panel === 'packs'" />
          <ModelCatalog v-else />
          <RequestSummary v-if="requestStep" />
        </div>
        <div v-else class="min-h-0 flex-1 overflow-auto">
          <ExtensionReview />
        </div>
        <DialogFooter
          v-if="s.panel === 'intro'"
          class="border-t border-border-subtle px-6 pt-4"
          ><Button variant="primary" size="lg" @click="s.continueFromIntro()">{{
            text('introGetStarted')
          }}</Button></DialogFooter
        >
        <DialogFooter
          v-else
          class="shrink-0 border-t border-border-subtle px-6 pt-4"
          ><p class="m-0 mr-auto text-xs text-muted-foreground">
            {{
              text(
                s.role === 'member' ? 'requestSubmitHint' : 'approvalReminder'
              )
            }}
          </p>
          <Button
            v-if="stepIndex > 0"
            size="sm"
            variant="secondary"
            @click="s.panel = flowSteps[stepIndex - 1] ?? null"
            >{{ text('backStep') }}</Button
          ><Button
            variant="primary"
            size="lg"
            :disabled="
              !s.editable ||
              !s.canManageExtensions ||
              (s.panel === 'review' &&
                (!s.state.draft.name.trim() || !s.selectedGpu))
            "
            @click="continueFlow"
            >{{
              text(
                requestStep
                  ? 'request'
                  : s.panel === 'review'
                    ? 'buildEnvironment'
                    : 'nextStep',
                { count: s.changes.length }
              )
            }}</Button
          ></DialogFooter
        >
      </DialogContent></DialogPortal
    ></Dialog
  >
  <aside
    v-if="s.panel === 'status' && s.state.phase !== 'updated'"
    class="flex w-md max-w-full shrink-0 flex-col overflow-hidden border-l border-border-subtle bg-base-background text-base-foreground max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40"
    :aria-label="text('title')"
  >
    <header
      class="flex items-center justify-between border-b border-border-subtle p-4"
    >
      <div>
        <h2 class="m-0 text-sm font-semibold">{{ text('progress') }}</h2>
        <p class="m-0 mt-1 text-xs text-muted-foreground">
          {{ s.state.draft.name }}
        </p>
      </div>
      <Button
        size="icon-sm"
        variant="muted-textonly"
        :aria-label="text('close')"
        @click="s.panel = null"
        ><i class="icon-[lucide--x] size-4"
      /></Button>
    </header>
    <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
      <div
        class="space-y-3 rounded-lg border border-border-subtle p-4"
        role="status"
      >
        <i
          v-if="['preparing', 'waiting', 'applying'].includes(s.state.phase)"
          class="icon-[lucide--loader-circle] size-5 animate-spin"
        />
        <h3 class="m-0 font-medium">
          {{
            text(
              s.requestPending && s.state.phase === 'idle'
                ? 'requestSent'
                : `status${phaseKey}`
            )
          }}
        </h3>
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{
            text(
              s.requestPending && s.state.phase === 'idle'
                ? 'tipRequestSent'
                : s.state.phase === 'applying' && s.state.draft.mode === 'new'
                  ? 'tipApplyingNew'
                  : `tip${phaseKey}`
            )
          }}
        </p>
      </div>
      <p
        v-if="s.state.phase === 'waiting'"
        class="m-0 text-xs leading-5 text-muted-foreground"
      >
        {{
          text('waitingJobCount', {
            running: pendingJobs.filter((job) => job.status === 'running')
              .length,
            queued: pendingJobs.filter((job) => job.status === 'queued').length
          })
        }}
      </p>
      <template v-if="s.state.phase === 'ready'"
        ><p class="m-0 text-xs leading-5">
          {{
            text(
              s.state.draft.mode === 'update'
                ? 'approvalUpdate'
                : 'approvalNew',
              { name: s.target.name }
            )
          }}
        </p>
        <details class="rounded-lg border border-border-subtle p-3 text-xs">
          <summary>{{ text('preparedSummary') }}</summary>
          <p class="m-0 mt-3">
            {{ s.state.draft.name }} ·
            {{ s.selectedGpu?.label ?? text('unknownGpuLabel') }} ·
            {{
              s.state.draft.models
                .map((value) => modelEntry(value).name)
                .join(', ')
            }}
          </p>
          <p v-for="id in s.changes" :key="id" class="m-0 mt-2">
            {{
              text('changeLine', {
                name: name(id),
                before: s.target.packs[id] ?? text('absent'),
                after: s.state.draft.packs[id] ?? text('removed')
              })
            }}
          </p>
        </details>
        <Button
          variant="primary"
          size="lg"
          class="w-full"
          :disabled="s.role !== 'admin'"
          @click="s.dispatch({ type: 'approve' })"
          >{{ text('approve') }}</Button
        ></template
      >
      <template v-if="s.state.phase === 'failed'"
        ><p role="alert" class="text-xs leading-5 text-node-stroke-error">
          {{ text('error') }}
        </p>
        <div class="space-y-2">
          <Button
            size="lg"
            variant="primary"
            class="w-full"
            @click="copy(s.repairContext)"
          >
            <i
              :class="
                cn(
                  'size-4',
                  copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
                )
              "
            />
            {{ text(copied ? 'copied' : 'copy') }}
          </Button>
          <p class="m-0 text-xs leading-5 text-muted-foreground">
            {{ text('copyHint') }}
          </p>
        </div>
        <div class="flex gap-2">
          <Button
            size="md"
            variant="secondary"
            class="flex-1"
            @click="s.prepare()"
            ><i class="icon-[lucide--refresh-cw] size-4" />{{
              text('retry')
            }}</Button
          >
          <Button size="md" variant="secondary" class="flex-1" @click="s.edit()"
            ><i class="icon-[lucide--pencil] size-4" />{{
              text('edit')
            }}</Button
          >
        </div>
        <details class="rounded-lg border border-border-subtle p-3 text-xs">
          <summary class="cursor-pointer">{{ text('errorDetails') }}</summary>
          <pre
            class="max-h-44 overflow-auto rounded-lg bg-secondary-background p-3 text-xs whitespace-pre-wrap"
            >{{ s.repairContext }}</pre>
        </details>
      </template>
      <PreparationStatus />
    </div>
  </aside>
</template>
