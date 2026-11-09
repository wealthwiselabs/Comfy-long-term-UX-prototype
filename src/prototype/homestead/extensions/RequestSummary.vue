<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { normalizeModels } from './catalog'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const name = (id: string) =>
  policyCatalog.find((pack) => pack.id === id)?.name ?? id
const addedModels = computed(() =>
  normalizeModels(s.state.draft.models).filter(
    (id) => !normalizeModels(s.target.models).includes(id)
  )
)
const removedModels = computed(() =>
  normalizeModels(s.target.models).filter(
    (id) => !normalizeModels(s.state.draft.models).includes(id)
  )
)
</script>
<template>
  <details class="shrink-0 border-t border-border-subtle">
    <summary class="cursor-pointer px-6 py-3 text-sm font-medium">
      {{ text('changes') }}
    </summary>
    <section
      :aria-label="text('changes')"
      class="max-h-44 space-y-4 overflow-auto px-6 pb-4"
    >
      <div class="space-y-3 text-xs leading-5">
        <p v-for="id in s.changes" :key="id" class="m-0">
          {{
            text('changeLine', {
              name: name(id),
              before: s.target.packs[id] ?? text('absent'),
              after: s.state.draft.packs[id] ?? text('removed')
            })
          }}
        </p>
        <i18n-t
          v-for="id in addedModels"
          :key="`add-${id}`"
          tag="p"
          keypath="extensionPrototype.requestModelAdd"
          class="m-0"
        >
          <template #name>{{ s.modelLabel(id) }}</template>
        </i18n-t>
        <i18n-t
          v-for="id in removedModels"
          :key="`remove-${id}`"
          tag="p"
          keypath="extensionPrototype.requestModelRemove"
          class="m-0"
        >
          <template #name>{{ s.modelLabel(id) }}</template>
        </i18n-t>
        <p
          v-if="
            !s.changes.length && !addedModels.length && !removedModels.length
          "
          class="m-0 text-muted-foreground"
        >
          {{ text('noRequestedChanges') }}
        </p>
      </div>
      <label class="block text-xs leading-5"
        >{{ text('requestNote')
        }}<textarea
          v-model="s.requestNote"
          rows="4"
          class="mt-2 block w-full resize-y rounded-lg border border-border-default bg-base-background p-3 font-sans text-sm"
          :disabled="!s.editable"
        />
      </label>
      <p class="m-0 text-xs leading-5 text-muted-foreground">
        {{ text('requestReviewHint') }}
      </p>
    </section>
  </details>
</template>
