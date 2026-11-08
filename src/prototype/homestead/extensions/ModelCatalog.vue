<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { modelCatalogFixture, modelEntry, normalizeModels } from './catalog'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const query = ref('')
const filter = ref('all')
const filters = ['all', 'checkpoint', 'lora', 'encoder', 'vae', 'unknown']
const rows = computed(() =>
  [
    ...modelCatalogFixture,
    ...normalizeModels([
      ...s.target.models,
      ...s.workflowModelIds,
      ...s.state.draft.models
    ])
      .map(modelEntry)
      .filter((item) => item.kind === 'unknown')
  ].filter(
    (item) =>
      (filter.value === 'all' || filter.value === item.kind) &&
      `${item.name} ${item.fileName} ${item.publisher}`
        .toLowerCase()
        .includes(query.value.toLowerCase())
  )
)
function toggleModel(id: string, event: Event) {
  if (
    !(event.target instanceof HTMLInputElement) ||
    !s.editable ||
    !s.canAddModels
  )
    return
  s.state.draft.models = event.target.checked
    ? [...new Set([...s.state.draft.models, id])]
    : s.state.draft.models.filter((value) => value !== id)
}
</script>
<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div class="shrink-0 space-y-3 px-6 py-3">
      <p class="m-0 text-xs leading-5 text-muted-foreground">
        {{ text('modelIntro') }}
      </p>
      <label class="block"
        ><span class="sr-only">{{ text('modelSearch') }}</span
        ><input
          v-model="query"
          :placeholder="text('modelSearch')"
          class="w-full rounded-lg border border-border-default bg-base-background px-3 py-2 text-sm"
      /></label>
      <div
        role="group"
        :aria-label="text('modelFilters')"
        class="flex flex-wrap gap-2"
      >
        <Button
          v-for="kind in filters"
          :key="kind"
          size="sm"
          :variant="filter === kind ? 'secondary' : 'muted-textonly'"
          :aria-pressed="filter === kind"
          @click="filter = kind"
          >{{ text(`modelKinds.${kind}`) }}</Button
        >
      </div>
    </div>
    <div class="min-h-24 flex-1 overflow-auto px-6">
      <table
        class="w-full table-fixed border-collapse text-left text-xs"
        :aria-label="text('modelStep')"
      >
        <thead class="sticky top-0 bg-base-background text-muted-foreground">
          <tr class="border-b border-border-subtle">
            <th scope="col" class="w-10 p-2">
              <span class="sr-only">{{ text('selectionColumn') }}</span>
            </th>
            <th scope="col" class="p-2 font-normal">
              {{ text('modelColumn') }}
            </th>
            <th scope="col" class="w-32 p-2 font-normal">
              {{ text('modelType') }}
            </th>
            <th scope="col" class="w-28 p-2 font-normal">
              {{ text('fileSize') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle">
          <tr v-for="model in rows" :key="model.id">
            <td class="p-2">
              <input
                type="checkbox"
                class="size-4 appearance-auto"
                :aria-label="text('includeModel', { name: model.name })"
                :checked="s.state.draft.models.includes(model.id)"
                :disabled="!s.editable || !s.canAddModels"
                @change="toggleModel(model.id, $event)"
              />
            </td>
            <td class="py-3 pr-3 pl-2">
              <p class="m-0 truncate text-sm font-medium">
                {{ model.name
                }}<span
                  v-if="s.workflowModelIds.includes(model.id)"
                  class="ml-2 text-xs font-normal text-muted-foreground"
                  >{{ text('fromWorkflow') }}</span
                >
              </p>
              <p class="m-0 mt-1 truncate text-muted-foreground">
                {{ model.fileName }}
              </p>
            </td>
            <td class="p-2 text-muted-foreground">
              {{ text(`modelKinds.${model.kind}`) }}
            </td>
            <td class="p-2 text-muted-foreground">
              {{
                model.sizeBytes === null
                  ? text('unknownSize')
                  : text('modelGb', {
                      size: (model.sizeBytes / 1024 ** 3).toFixed(2)
                    })
              }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="m-0 p-6 text-sm text-muted-foreground">
        {{ text('noModels') }}
      </p>
    </div>
    <p class="m-0 shrink-0 px-6 py-3 text-xs text-muted-foreground">
      {{ text('selectedModelsCount', { count: s.state.draft.models.length }) }}
      · {{ text('modelSizeFixture') }}
    </p>
  </div>
</template>
