<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { NODE_PACK_DETAILS } from '../../fixtures/nodePacks'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const query = ref('')
const filter = ref<'all' | 'installed' | 'updates'>('all')
const github = ref('')
const zip = ref('')
const sourceError = ref(false)
const packs = policyCatalog.filter(
  (pack) => pack.kind === 'nodes' && pack.allowed
)
function versions(id: string) {
  const pack = packs.find((item) => item.id === id)
  return [
    ...new Set([
      ...(s.target.packs[id] ? [s.target.packs[id]] : []),
      ...(NODE_PACK_DETAILS[id]?.releases.map((item) => item.version) ??
        (pack ? [pack.version] : []))
    ])
  ]
}
function latestVersion(id: string) {
  return (
    NODE_PACK_DETAILS[id]?.releases[0]?.version ??
    packs.find((item) => item.id === id)?.version
  )
}
function hasUpdate(id: string) {
  return Boolean(s.target.packs[id] && latestVersion(id) !== s.target.packs[id])
}
const filters = computed(
  () =>
    [
      { id: 'all', label: 'allPacks', count: packs.length },
      {
        id: 'installed',
        label: 'installedFilter',
        count: packs.filter((pack) => s.target.packs[pack.id]).length
      },
      {
        id: 'updates',
        label: 'updatesFilter',
        count: packs.filter((pack) => hasUpdate(pack.id)).length
      }
    ] as const
)
const catalog = computed(() =>
  packs.filter((pack) => {
    const matchesFilter =
      filter.value === 'all' ||
      (filter.value === 'installed'
        ? Boolean(s.target.packs[pack.id])
        : hasUpdate(pack.id))
    return (
      matchesFilter &&
      `${pack.name} ${pack.publisher} ${text(`packDescriptions.${pack.id}`)}`
        .toLowerCase()
        .includes(query.value.toLowerCase())
    )
  })
)
const customSources = computed(() =>
  Object.keys(s.state.draft.packs).filter(
    (id) => !policyCatalog.some((pack) => pack.id === id)
  )
)
function packStatus(id: string) {
  if (s.state.draft.packs[id] !== s.target.packs[id])
    return !s.state.draft.packs[id]
      ? 'pendingRemoval'
      : s.target.packs[id]
        ? 'pendingUpdate'
        : 'pendingAdd'
  return hasUpdate(id)
    ? 'updateAvailable'
    : s.target.packs[id]
      ? 'installedStatus'
      : 'available'
}
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
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 space-y-4 px-6 pt-3 pb-4">
      <label class="relative block"
        ><i
          class="pointer-events-none absolute top-2.5 left-3 icon-[lucide--search] size-4 text-muted-foreground" /><span
          class="sr-only"
          >{{ text('search') }}</span
        ><input
          v-model="query"
          :placeholder="text('searchPlaceholder')"
          class="w-full rounded-lg border border-border-default bg-base-background py-2 pr-3 pl-9 text-sm"
      /></label>
      <div
        role="group"
        :aria-label="text('packFilters')"
        class="flex flex-wrap gap-2"
      >
        <Button
          v-for="item in filters"
          :id="`extension-tab-${item.id}`"
          :key="item.id"
          :aria-pressed="filter === item.id"
          aria-controls="extension-pack-results"
          size="sm"
          :variant="filter === item.id ? 'secondary' : 'muted-textonly'"
          @click="filter = item.id"
          >{{ text(item.label, { count: item.count }) }}</Button
        >
      </div>
    </div>
    <div
      id="extension-pack-results"
      :aria-labelledby="`extension-tab-${filter}`"
      class="min-h-0 flex-1 overflow-auto px-6"
    >
      <table
        class="w-full min-w-3xl table-fixed border-collapse text-left text-xs"
        :aria-label="text('packs')"
      >
        <thead
          class="sticky top-0 z-10 bg-base-background text-muted-foreground"
        >
          <tr class="border-b border-border-subtle">
            <th scope="col" class="px-3 py-2 font-normal">
              {{ text('packColumn') }}
            </th>
            <th scope="col" class="w-28 px-3 py-2 font-normal">
              {{ text('publisherColumn') }}
            </th>
            <th scope="col" class="w-32 px-3 py-2 font-normal">
              {{ text('versionColumn') }}
            </th>
            <th scope="col" class="w-32 px-3 py-2 font-normal">
              {{ text('statusColumn') }}
            </th>
            <th scope="col" class="w-40 px-3 py-2 font-normal">
              {{ text('selectionColumn') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle">
          <tr v-for="pack in catalog" :key="pack.id">
            <td class="px-3 py-3">
              <p class="m-0 truncate text-sm font-medium">{{ pack.name }}</p>
              <p
                class="m-0 mt-1 truncate text-muted-foreground"
                :title="text(`packDescriptions.${pack.id}`)"
              >
                {{ text(`packDescriptions.${pack.id}`) }}
              </p>
            </td>
            <td class="truncate px-3 py-3 text-muted-foreground">
              {{ pack.publisher }}
            </td>
            <td class="px-3 py-3">
              <p v-if="s.target.packs[pack.id]" class="m-0">
                {{
                  text('installedVersion', { version: s.target.packs[pack.id] })
                }}
              </p>
              <p class="m-0 mt-1 text-muted-foreground">
                {{
                  text('availableVersion', { version: latestVersion(pack.id) })
                }}
              </p>
            </td>
            <td class="px-3 py-3">
              <span
                class="rounded-sm bg-secondary-background px-2 py-1 whitespace-nowrap"
                >{{ text(packStatus(pack.id)) }}</span
              >
            </td>
            <td class="px-3 py-3">
              <select
                :value="s.state.draft.packs[pack.id] ?? ''"
                :aria-label="text('selectVersion', { name: pack.name })"
                :disabled="!s.editable"
                class="w-full rounded-sm border border-border-default bg-base-background p-2"
                @change="selectVersion(pack.id, $event)"
              >
                <option v-if="!s.target.packs[pack.id]" value="">
                  {{ text('absent') }}
                </option>
                <option v-else value="">{{ text('remove') }}</option>
                <option
                  v-for="version in versions(pack.id)"
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
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="!catalog.length"
        class="m-0 p-6 text-center text-sm text-muted-foreground"
      >
        {{ text('noResults') }}
      </p>
      <div class="space-y-3 py-4 text-sm">
        <details class="rounded-lg border border-border-subtle p-3">
          <summary class="cursor-pointer font-medium">
            {{ text('source') }}
          </summary>
          <div class="mt-3 space-y-3">
            <p class="m-0 text-xs leading-5 text-muted-foreground">
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
              class="m-0 text-xs text-node-stroke-error"
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
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{ text('nodeLimits') }}
        </p>
      </div>
    </div>
  </div>
</template>
