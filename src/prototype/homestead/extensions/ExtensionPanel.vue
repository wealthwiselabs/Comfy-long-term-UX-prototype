<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import Button from '@/components/ui/button/Button.vue'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { canRun } from './model'
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
const s = useExtensionManagerStore()
const nodeDefs = useNodeDefStore()
const insertable = computed(() =>
  [
    { pack: 'comfyui-rmbg', type: 'RMBG' },
    { pack: 'acme-matte-tools', type: 'AcmeMatteRefine' }
  ].filter(
    (item) =>
      s.selectedEnvironment.packs[item.pack] &&
      nodeDefs.nodeDefsByName[item.type]
  )
)
function insertNode(type: string) {
  const definition = nodeDefs.nodeDefsByName[type]
  if (definition) useLitegraphService().addNodeOnGraph(definition)
}
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const { copy, copied } = useClipboard()
const name = (id: string) =>
  policyCatalog.find((pack) => pack.id === id)?.name ?? id
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
  get: () => s.panel === 'packs' || s.panel === 'review',
  set: (open) => {
    if (!open && (s.panel === 'packs' || s.panel === 'review')) s.panel = null
  }
})
</script>
<template>
  <Dialog v-model:open="managerOpen"
    ><DialogPortal
      ><DialogOverlay /><DialogContent
        size="xl"
        class="h-[min(85vh,50rem)] overflow-hidden sm:max-w-6xl"
        @open-auto-focus="captureReturnFocus"
        @close-auto-focus.prevent="restoreFocus"
      >
        <DialogHeader
          class="shrink-0 flex-col items-stretch gap-2 border-b border-border-subtle px-6 pt-5 pb-4"
          ><div class="flex items-center justify-between gap-3">
            <DialogTitle class="m-0">{{
              text(s.panel === 'review' ? 'review' : 'packs')
            }}</DialogTitle
            ><DialogClose
              ><Button
                size="icon-sm"
                variant="muted-textonly"
                :aria-label="text('close')"
                ><i class="icon-[lucide--x] size-4" /></Button
            ></DialogClose>
          </div>
          <DialogDescription class="m-0">{{
            s.scenario === 'first'
              ? text('firstTitle')
              : text('target', s.target)
          }}</DialogDescription></DialogHeader
        >
        <div
          v-if="s.scenario === 'first'"
          class="min-h-0 flex-1 space-y-5 overflow-auto p-6 text-sm"
        >
          <i class="icon-[lucide--blocks] size-8 text-muted-foreground" />
          <h3 class="text-lg font-medium">{{ text('firstTitle') }}</h3>
          <p class="m-0 leading-6 text-muted-foreground">
            {{ text('firstBody') }}
          </p>
          <Button
            as="a"
            href="https://platform.comfy.org/profile/builds/new"
            target="_blank"
            rel="noopener noreferrer"
            >{{ text('create') }}<i class="icon-[lucide--external-link] size-4"
          /></Button>
          <p class="m-0 text-xs text-muted-foreground">{{ text('handoff') }}</p>
        </div>
        <PackCatalog v-else-if="s.panel === 'packs'" />
        <div v-else class="min-h-0 flex-1 overflow-auto">
          <ExtensionReview />
        </div>
        <DialogFooter
          v-if="s.scenario !== 'first'"
          class="shrink-0 border-t border-border-subtle px-6 pt-4"
          ><p class="m-0 mr-auto text-xs text-muted-foreground">
            {{ text('approvalReminder') }}
          </p>
          <Button
            v-if="s.panel === 'review'"
            size="sm"
            variant="secondary"
            @click="s.panel = 'packs'"
            >{{ text('back') }}</Button
          ><Button
            :disabled="
              !s.editable ||
              !s.state.draft.name.trim() ||
              !Number.isFinite(s.state.draft.storage) ||
              s.state.draft.storage < 0
            "
            @click="
              s.role === 'member'
                ? s.request()
                : s.panel === 'packs'
                  ? (s.panel = 'review')
                  : s.prepare()
            "
            >{{
              text(
                s.role === 'member'
                  ? 'request'
                  : s.panel === 'packs'
                    ? 'reviewChanges'
                    : 'prepare',
                { count: s.changes.length }
              )
            }}</Button
          ></DialogFooter
        >
      </DialogContent></DialogPortal
    ></Dialog
  >
  <aside
    v-if="s.panel === 'status'"
    class="flex w-md max-w-full shrink-0 flex-col overflow-hidden border-l border-border-subtle bg-base-background text-base-foreground max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40"
    :aria-label="text('title')"
  >
    <header
      class="flex items-center justify-between border-b border-border-subtle p-4"
    >
      <div>
        <h2 class="text-sm font-semibold">{{ text('progress') }}</h2>
        <p class="m-0 mt-1 text-xs text-muted-foreground">
          {{ text('target', s.target) }}
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
        /><i
          v-else-if="s.state.phase === 'updated'"
          class="icon-[lucide--circle-check] size-5"
        />
        <h3 class="font-medium">
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
                : `tip${phaseKey}`
            )
          }}
        </p>
      </div>
      <template v-if="s.state.phase === 'ready'"
        ><p class="m-0 text-xs leading-5">
          {{
            text(
              s.state.draft.mode === 'update' ? 'approvalUpdate' : 'approvalNew'
            )
          }}
        </p>
        <details class="rounded-lg border border-border-subtle p-3 text-xs">
          <summary>{{ text('preparedSummary') }}</summary>
          <p class="m-0 mt-3">
            {{ s.state.draft.name }} · {{ s.state.draft.gpu }} ·
            {{ s.state.draft.models.join(', ') }}
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
        <div class="flex gap-2">
          <Button size="sm" @click="s.prepare()">{{ text('retry') }}</Button
          ><Button size="sm" variant="secondary" @click="s.edit()">{{
            text('edit')
          }}</Button>
        </div>
        <Button size="sm" variant="secondary" @click="copy(s.repairContext)">{{
          text(copied ? 'copied' : 'copy')
        }}</Button>
        <p class="m-0 text-xs text-muted-foreground">{{ text('copyHint') }}</p>
        <pre
          class="max-h-44 overflow-auto rounded-lg bg-secondary-background p-3 text-xs whitespace-pre-wrap"
          >{{ s.repairContext }}</pre>
      </template>
      <section v-if="s.state.phase === 'updated'" class="space-y-2">
        <p class="m-0 text-xs text-muted-foreground">{{ text('viewNodes') }}</p>
        <Button
          v-for="node in insertable"
          :key="node.type"
          size="sm"
          variant="secondary"
          @click="insertNode(node.type)"
          >{{ text('insertNode', { name: node.type }) }}</Button
        >
      </section>
      <section class="space-y-2">
        <h3 class="text-xs font-medium">{{ text('jobs') }}</h3>
        <p
          v-if="!s.state.jobs.length"
          class="m-0 text-xs text-muted-foreground"
        >
          {{ text('noJobs') }}
        </p>
        <p
          v-for="job in s.state.jobs"
          :key="job.id"
          class="m-0 rounded-sm bg-secondary-background p-2 text-xs"
        >
          {{
            text('job', {
              id: job.id,
              environment: job.environmentId,
              revision: job.revision,
              status: job.status
            })
          }}
        </p>
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{ text('queueHint') }}
        </p>
      </section>
      <section class="space-y-2">
        <h3 class="text-xs font-medium">{{ text('sessions') }}</h3>
        <p
          v-for="(environmentId, session) in s.state.sessions"
          :key="session"
          class="m-0 text-xs leading-5"
        >
          {{
            text('session', {
              name: session,
              environment: environmentId,
              revision: s.state.environments[environmentId]?.revision ?? 4,
              availability: text(
                canRun(s.state, environmentId) ? 'runOpen' : 'runLocked'
              )
            })
          }}
        </p>
      </section>
      <Button
        v-if="s.state.phase === 'updated'"
        size="sm"
        variant="secondary"
        @click="s.edit()"
        >{{ text('openPacks') }}</Button
      >
    </div>
  </aside>
</template>
