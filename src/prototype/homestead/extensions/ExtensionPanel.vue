<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import Button from '@/components/ui/button/Button.vue'
import { NODE_PACK_DETAILS } from '../../fixtures/nodePacks'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { canRun } from './model'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const gpuOptions = ['A100 · 80 GB', 'L40S · 48 GB']
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
const query = ref('')
const github = ref('')
const zip = ref('')
const sourceError = ref(false)
const { copy, copied } = useClipboard()
const catalog = computed(() =>
  policyCatalog.filter(
    (pack) =>
      pack.kind === 'nodes' &&
      pack.allowed &&
      `${pack.name} ${pack.publisher}`
        .toLowerCase()
        .includes(query.value.toLowerCase())
  )
)
const customSources = computed(() =>
  Object.keys(s.state.draft.packs).filter(
    (id) => !policyCatalog.some((pack) => pack.id === id)
  )
)
const changes = computed(() =>
  [
    ...new Set([
      ...Object.keys(s.target.packs),
      ...Object.keys(s.state.draft.packs)
    ])
  ].filter((id) => s.target.packs[id] !== s.state.draft.packs[id])
)
const name = (id: string) =>
  policyCatalog.find((pack) => pack.id === id)?.name ?? id
const gpuRate = computed(() =>
  s.state.draft.gpu.startsWith('A100') ? '0.0012' : '0.0006'
)
const modelText = computed({
  get: () => s.state.draft.models.join(', '),
  set: (value) => {
    s.state.draft.models = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
})
const phaseKey = computed(
  () => s.state.phase[0].toUpperCase() + s.state.phase.slice(1)
)
function selectVersion(id: string, event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  if (event.target.value) s.state.draft.packs[id] = event.target.value
  else delete s.state.draft.packs[id]
}
function addSource(kind: 'github' | 'zip') {
  const value = (kind === 'github' ? github.value : zip.value).trim()
  const valid =
    kind === 'github'
      ? /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(value)
      : /^[^/\\]+\.zip$/i.test(value)
  sourceError.value = !valid
  if (!valid) return
  s.state.draft.packs[value] = 'demo'
  if (kind === 'github') github.value = ''
  else zip.value = ''
}
</script>
<template>
  <aside
    v-if="s.panel"
    class="flex w-md max-w-full shrink-0 flex-col overflow-hidden border-l border-border-subtle bg-base-background text-base-foreground max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40"
    :aria-label="text('title')"
  >
    <header
      class="flex items-center justify-between border-b border-border-subtle p-4"
    >
      <div>
        <h2 class="text-sm font-semibold">
          {{
            text(
              s.panel === 'packs'
                ? 'packs'
                : s.panel === 'review'
                  ? 'review'
                  : 'progress'
            )
          }}
        </h2>
        <p class="mt-1 text-xs text-muted-foreground">
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
      <template v-if="s.scenario === 'first'">
        <i class="icon-[lucide--blocks] size-8 text-muted-foreground" />
        <h3 class="text-lg font-medium">{{ text('firstTitle') }}</h3>
        <p class="leading-6 text-muted-foreground">{{ text('firstBody') }}</p>
        <Button
          as="a"
          href="https://platform.comfy.org/profile/builds/new"
          target="_blank"
          rel="noopener noreferrer"
          >{{ text('create') }}<i class="icon-[lucide--external-link] size-4"
        /></Button>
        <p class="text-xs text-muted-foreground">{{ text('handoff') }}</p>
      </template>
      <template v-else-if="s.panel === 'packs'">
        <p class="text-xs leading-5 text-muted-foreground">
          {{ text('selectionHint') }}
        </p>
        <label class="block"
          ><span class="sr-only">{{ text('search') }}</span
          ><input
            v-model="query"
            :placeholder="text('searchPlaceholder')"
            class="w-full rounded-lg border border-border-default bg-base-background px-3 py-2"
        /></label>
        <div
          class="divide-y divide-border-subtle rounded-lg border border-border-subtle"
        >
          <div
            v-for="pack in catalog"
            :key="pack.id"
            class="grid grid-cols-[1fr_auto] items-center gap-3 p-3"
          >
            <div class="flex justify-between gap-2">
              <div>
                <p class="font-medium">{{ pack.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ pack.publisher }} ·
                  {{
                    s.target.packs[pack.id]
                      ? text('installed', { version: s.target.packs[pack.id] })
                      : text('available')
                  }}
                </p>
              </div>
              <i
                v-if="s.state.draft.packs[pack.id] !== s.target.packs[pack.id]"
                class="icon-[lucide--circle-check] size-4 text-primary-background"
              />
            </div>
            <select
              :value="s.state.draft.packs[pack.id] ?? ''"
              :aria-label="text('selectVersion', { name: pack.name })"
              :disabled="!s.editable"
              class="w-36 rounded-sm border border-border-default bg-base-background px-2 py-1.5 text-xs"
              @change="selectVersion(pack.id, $event)"
            >
              <option v-if="!s.target.packs[pack.id]" value="">
                {{ text('absent') }}
              </option>
              <option v-else value="">{{ text('remove') }}</option>
              <option
                v-for="version in [
                  ...new Set([
                    ...(s.target.packs[pack.id]
                      ? [s.target.packs[pack.id]]
                      : []),
                    ...(NODE_PACK_DETAILS[pack.id]?.releases.map(
                      (item) => item.version
                    ) ?? [pack.version])
                  ])
                ]"
                :key="version"
                :value="version"
              >
                {{
                  text(
                    s.target.packs[pack.id] === version
                      ? 'unchanged'
                      : s.target.packs[pack.id]
                        ? 'update'
                        : 'add',
                    { version }
                  )
                }}
              </option>
            </select>
          </div>
          <p v-if="!catalog.length" class="p-4 text-muted-foreground">
            {{ text('noResults') }}
          </p>
        </div>
        <details class="rounded-lg border border-border-subtle p-3">
          <summary class="cursor-pointer font-medium">
            {{ text('source') }}
          </summary>
          <div class="mt-3 space-y-3">
            <p class="text-xs leading-5 text-muted-foreground">
              {{ text('sourceHint') }}
            </p>
            <label class="block text-xs"
              >{{ text('github')
              }}<input
                v-model="github"
                :placeholder="text('githubPlaceholder')"
                class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2" /></label
            ><Button
              size="sm"
              variant="secondary"
              :disabled="!s.editable"
              @click="addSource('github')"
              >{{ text('addGithub') }}</Button
            ><label class="block text-xs"
              >{{ text('zip')
              }}<input
                v-model="zip"
                :placeholder="text('zipPlaceholder')"
                class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2" /></label
            ><Button
              size="sm"
              variant="secondary"
              :disabled="!s.editable"
              @click="addSource('zip')"
              >{{ text('addZip') }}</Button
            >
            <p
              v-if="sourceError"
              role="alert"
              class="text-xs text-node-stroke-error"
            >
              {{ text('invalidSource') }}
            </p>
          </div>
        </details>
        <div v-if="customSources.length" class="space-y-2">
          <h3 class="text-xs font-medium">{{ text('customAdded') }}</h3>
          <div
            v-for="source in customSources"
            :key="source"
            class="flex items-center justify-between gap-2 rounded-lg bg-secondary-background p-2 text-xs"
          >
            <span class="break-all">{{ source }}</span
            ><Button
              size="icon-sm"
              variant="muted-textonly"
              :aria-label="text('removeSource', { name: source })"
              :disabled="!s.editable"
              @click="delete s.state.draft.packs[source]"
              ><i class="icon-[lucide--x] size-3"
            /></Button>
          </div>
        </div>
        <p class="text-xs leading-5 text-muted-foreground">
          {{ text('nodeLimits') }}
        </p>
      </template>
      <template v-else-if="s.panel === 'review'">
        <fieldset class="space-y-2">
          <legend class="mb-2 font-medium">{{ text('destination') }}</legend>
          <label class="flex gap-2"
            ><input
              v-model="s.state.draft.mode"
              type="radio"
              class="size-4 appearance-auto"
              value="update"
              :disabled="!s.editable"
            />{{ text('updateEnvironment') }}</label
          ><label class="flex gap-2"
            ><input
              v-model="s.state.draft.mode"
              type="radio"
              class="size-4 appearance-auto"
              value="new"
              :disabled="!s.editable"
            />{{ text('newEnvironment') }}</label
          >
          <p
            class="rounded-lg bg-secondary-background p-3 text-xs leading-5 text-muted-foreground"
          >
            {{
              text(
                s.state.draft.mode === 'update' ? 'sharedEffect' : 'newEffect'
              )
            }}
          </p>
        </fieldset>
        <fieldset :disabled="!s.editable" class="space-y-3">
          <legend class="mb-2 font-medium">{{ text('settings') }}</legend>
          <label class="block text-xs"
            >{{ text('name')
            }}<input
              v-model="s.state.draft.name"
              class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2" /></label
          ><label class="block text-xs"
            >{{ text('models')
            }}<input
              v-model="modelText"
              class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2" /></label
          ><label class="block text-xs"
            >{{ text('gpu')
            }}<select
              v-model="s.state.draft.gpu"
              class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2"
            >
              <option v-for="gpu in gpuOptions" :key="gpu" :value="gpu">
                {{ gpu }}
              </option>
            </select></label
          ><label class="block text-xs"
            >{{ text('storage')
            }}<input
              v-model.number="s.state.draft.storage"
              type="number"
              min="0"
              max="10000"
              class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2"
          /></label>
        </fieldset>
        <section class="space-y-2 rounded-lg border border-border-default p-3">
          <h3 class="font-medium">{{ text('cost') }}</h3>
          <p class="text-xs">{{ text('gpuCost', { rate: gpuRate }) }}</p>
          <p class="text-xs">
            {{
              text('storageCost', {
                size: s.state.draft.storage,
                estimate: (s.state.draft.storage * 0.07).toFixed(2)
              })
            }}
          </p>
          <p class="text-xs leading-5 text-muted-foreground">
            {{ text('sampleRates') }}
          </p>
          <p class="text-xs text-muted-foreground">{{ text('noTier') }}</p>
        </section>
        <section class="space-y-2">
          <h3 class="font-medium">{{ text('changes') }}</h3>
          <p v-for="id in changes" :key="id" class="text-xs leading-5">
            {{
              text('changeLine', {
                name: name(id),
                before: s.target.packs[id] ?? text('absent'),
                after: s.state.draft.packs[id] ?? text('removed')
              })
            }}
          </p>
          <p v-if="!changes.length" class="text-xs text-muted-foreground">
            {{ text('noChanges') }}
          </p>
        </section>
      </template>
      <template v-else>
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
          <h3 class="font-medium">{{ text(`status${phaseKey}`) }}</h3>
          <p class="text-xs leading-5 text-muted-foreground">
            {{ text(`tip${phaseKey}`) }}
          </p>
        </div>
        <template v-if="s.state.phase === 'ready'"
          ><p class="text-xs leading-5">
            {{
              text(
                s.state.draft.mode === 'update'
                  ? 'approvalUpdate'
                  : 'approvalNew'
              )
            }}
          </p>
          <details class="rounded-lg border border-border-subtle p-3 text-xs">
            <summary>{{ text('preparedSummary') }}</summary>
            <p class="mt-3">
              {{ s.state.draft.name }} · {{ s.state.draft.gpu }} ·
              {{ s.state.draft.models.join(', ') }}
            </p>
            <p v-for="id in changes" :key="id" class="mt-2">
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
          <Button
            size="sm"
            variant="secondary"
            @click="copy(s.repairContext)"
            >{{ text(copied ? 'copied' : 'copy') }}</Button
          >
          <p class="text-xs text-muted-foreground">{{ text('copyHint') }}</p>
          <pre
            class="max-h-44 overflow-auto rounded-lg bg-secondary-background p-3 text-xs whitespace-pre-wrap"
            >{{ s.repairContext }}</pre>
        </template>
        <section v-if="s.state.phase === 'updated'" class="space-y-2">
          <p class="text-xs text-muted-foreground">{{ text('viewNodes') }}</p>
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
          <p v-if="!s.state.jobs.length" class="text-xs text-muted-foreground">
            {{ text('noJobs') }}
          </p>
          <p
            v-for="job in s.state.jobs"
            :key="job.id"
            class="rounded-sm bg-secondary-background p-2 text-xs"
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
          <p class="text-xs leading-5 text-muted-foreground">
            {{ text('queueHint') }}
          </p>
        </section>
        <section class="space-y-2">
          <h3 class="text-xs font-medium">{{ text('sessions') }}</h3>
          <p
            v-for="(environmentId, session) in s.state.sessions"
            :key="session"
            class="text-xs leading-5"
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
      </template>
    </div>
    <footer
      v-if="s.scenario !== 'first' && s.panel !== 'status'"
      class="flex shrink-0 items-center gap-2 border-t border-border-subtle p-4"
    >
      <Button
        v-if="s.panel === 'review'"
        size="sm"
        variant="secondary"
        @click="s.panel = 'packs'"
        >{{ text('back') }}</Button
      ><Button
        class="flex-1"
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
            { count: changes.length }
          )
        }}</Button
      >
    </footer>
  </aside>
</template>
