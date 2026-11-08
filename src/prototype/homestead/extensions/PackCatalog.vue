<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { NODE_PACK_DETAILS } from '../../fixtures/nodePacks'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { useExtensionManagerStore } from './store'
import PackSources from './PackSources.vue'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const query = ref('')
const filter = ref<'all' | 'installed' | 'updates'>('all')
const sourceOpen = ref(false)
const page = ref(1)
const pageSize = 5
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
const pageCount = computed(() =>
  Math.max(1, Math.ceil(catalog.value.length / pageSize))
)
const currentPage = computed(() => Math.min(page.value, pageCount.value))
const visiblePacks = computed(() =>
  catalog.value.slice(
    (currentPage.value - 1) * pageSize,
    currentPage.value * pageSize
  )
)
function choice(id: string) {
  return (
    s.state.draft.packs[id] ??
    s.excludedVersions[id] ??
    s.target.packs[id] ??
    latestVersion(id)
  )
}
function togglePack(id: string, event: Event) {
  if (!(event.target instanceof HTMLInputElement) || !s.editable) return
  if (event.target.checked) {
    s.state.draft.packs[id] = choice(id)
    delete s.excludedVersions[id]
  } else {
    s.excludedVersions[id] = choice(id)
    delete s.state.draft.packs[id]
  }
}
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
function selectFilter(id: 'all' | 'installed' | 'updates') {
  filter.value = id
  page.value = 1
}
function selectVersion(id: string, event: Event) {
  if (!(event.target instanceof HTMLSelectElement) || !s.editable) return
  if (s.state.draft.packs[id]) s.state.draft.packs[id] = event.target.value
  else s.excludedVersions[id] = event.target.value
}
</script>
<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 space-y-4 px-6 pt-3 pb-4">
      <div class="flex items-center gap-3">
        <label class="relative block flex-1"
          ><i
            class="pointer-events-none absolute top-2.5 left-3 icon-[lucide--search] size-4 text-muted-foreground" /><span
            class="sr-only"
            >{{ text('search') }}</span
          ><input
            v-model="query"
            :placeholder="text('searchPlaceholder')"
            class="w-full rounded-lg border border-border-default bg-base-background py-2 pr-3 pl-9 text-sm"
            @input="page = 1" /></label
        ><Button
          size="sm"
          variant="secondary"
          :aria-expanded="sourceOpen"
          aria-controls="extension-pack-sources"
          @click="sourceOpen = !sourceOpen"
          ><i class="icon-[lucide--plus] size-4" />{{ text('addOwn') }}</Button
        >
      </div>
      <PackSources :open="sourceOpen" />
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
          @click="selectFilter(item.id)"
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
            <th scope="col" class="w-10 px-3 py-2 font-normal">
              <span class="sr-only">{{ text('selectionColumn') }}</span>
            </th>
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
            <th scope="col" class="w-28 px-3 py-2 font-normal">
              {{ text('desiredVersion') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle">
          <tr v-for="pack in visiblePacks" :key="pack.id">
            <td class="px-3 py-3">
              <input
                type="checkbox"
                class="size-4 appearance-auto"
                :aria-label="text('includePack', { name: pack.name })"
                :checked="Boolean(s.state.draft.packs[pack.id])"
                :disabled="!s.editable"
                @change="togglePack(pack.id, $event)"
              />
            </td>
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
                :value="choice(pack.id)"
                :aria-label="text('selectVersion', { name: pack.name })"
                :disabled="!s.editable"
                class="w-full rounded-sm border border-border-default bg-base-background p-2"
                @change="selectVersion(pack.id, $event)"
              >
                <option
                  v-for="version in versions(pack.id)"
                  :key="version"
                  :value="version"
                >
                  {{ version }}
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
    </div>
    <nav
      class="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-3 text-xs text-muted-foreground"
      :aria-label="text('pagination')"
    >
      <span>{{
        text('resultsRange', {
          start: catalog.length ? (currentPage - 1) * pageSize + 1 : 0,
          end: Math.min(currentPage * pageSize, catalog.length),
          total: catalog.length
        })
      }}</span>
      <div class="flex items-center gap-3">
        <Button
          size="sm"
          variant="muted-textonly"
          :aria-label="text('previousPage')"
          :disabled="currentPage <= 1"
          @click="page = currentPage - 1"
          ><i class="icon-[lucide--chevron-left] size-4" />{{
            text('previous')
          }}</Button
        ><span>{{
          text('pageCount', { page: currentPage, total: pageCount })
        }}</span
        ><Button
          size="sm"
          variant="muted-textonly"
          :aria-label="text('nextPage')"
          :disabled="currentPage >= pageCount"
          @click="page = currentPage + 1"
          >{{ text('next') }}<i class="icon-[lucide--chevron-right] size-4"
        /></Button>
      </div>
    </nav>
  </div>
</template>
