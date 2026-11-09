<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import {
  cloudReadyModel,
  modelCatalogFixture,
  normalizeModels
} from './catalog'
import ModelImportPanel from './ModelImportPanel.vue'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const query = ref('')
const importOpen = ref(false)
const filter = ref('all')
const filters = ['all', 'checkpoint', 'lora', 'encoder', 'vae', 'unknown']
const rows = computed(() =>
  [
    ...s.importedModels,
    ...normalizeModels(s.target.models)
      .filter(
        (id) =>
          !cloudReadyModel(id) &&
          !s.importedModels.some((entry) => entry.id === id)
      )
      .map(s.modelDetails),
    ...modelCatalogFixture
  ].filter(
    (item) =>
      (filter.value === 'all' || filter.value === item.kind) &&
      `${item.name} ${item.fileName} ${item.publisher}`
        .toLowerCase()
        .includes(query.value.toLowerCase())
  )
)
function toggleModel(id: string, event: Event) {
  if (event.target instanceof HTMLInputElement)
    s.toggleModel(id, event.target.checked)
}
</script>
<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div class="shrink-0 space-y-3 px-6 py-3">
      <p class="m-0 text-xs leading-5 text-muted-foreground">
        {{ text('modelIntro') }}
      </p>
      <div class="flex items-center justify-between gap-3">
        <p class="m-0 text-xs text-muted-foreground">
          {{ text('modelCloudFixture') }}
        </p>
        <Button
          size="sm"
          variant="secondary"
          :aria-expanded="importOpen"
          aria-controls="extension-model-import"
          :disabled="!s.editable || !s.canAddModels"
          @click="importOpen = !importOpen"
          >{{ text('modelImportTitle') }}</Button
        >
      </div>
      <ModelImportPanel v-if="importOpen" @close="importOpen = false" />
      <section
        v-if="s.unresolvedWorkflowModels.length"
        class="space-y-2 rounded-lg border border-border-default p-3"
        :aria-label="text('modelUnresolvedTitle')"
      >
        <h3 class="m-0 text-xs font-medium">
          {{ text('modelUnresolvedTitle') }}
        </h3>
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{ text('modelUnresolvedHint') }}
        </p>
        <p
          v-for="id in s.unresolvedWorkflowModels"
          :key="id"
          class="m-0 truncate text-xs"
        >
          {{ /[\\/]/.test(id) ? id : s.modelDetails(id).fileName }}
        </p>
        <Button
          size="sm"
          variant="secondary"
          :disabled="!s.editable || !s.canAddModels"
          @click="importOpen = true"
          >{{ text('modelResolveAction') }}</Button
        >
      </section>
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
                  v-if="
                    s.workflowModelIds.some(
                      (value) =>
                        cloudReadyModel(value)?.id === model.id ||
                        value === model.id
                    )
                  "
                  class="ml-2 text-xs font-normal text-muted-foreground"
                  >{{ text('fromWorkflow') }}</span
                >
              </p>
              <p class="m-0 mt-1 truncate text-muted-foreground">
                {{
                  model.directory
                    ? `models/${model.directory}/${model.fileName}`
                    : model.fileName
                }}
              </p>
              <p class="m-0 mt-1 text-muted-foreground">
                {{
                  text(
                    s.importedModels.some((entry) => entry.id === model.id)
                      ? 'modelImportedStatus'
                      : cloudReadyModel(model.id)
                        ? 'modelCloudStatus'
                        : 'modelInheritedStatus'
                  )
                }}
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
