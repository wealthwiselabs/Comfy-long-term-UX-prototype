<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const gpuOptions = ['A100 · 80 GB', 'L40S · 48 GB']
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
</script>
<template>
  <div class="grid gap-6 p-6 md:grid-cols-2">
    <div class="space-y-5">
      <fieldset class="m-0 min-w-0 space-y-2 border-0 p-0">
        <legend class="mb-2 p-0 font-medium">{{ text('destination') }}</legend>
        <label v-if="!s.firstSetup" class="flex gap-2"
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
          class="m-0 rounded-lg bg-secondary-background p-3 text-xs leading-5 text-muted-foreground"
        >
          {{
            text(
              s.state.draft.mode === 'update' ? 'sharedEffect' : 'newEffect',
              { name: s.target.name }
            )
          }}
        </p>
      </fieldset>
      <fieldset
        :disabled="!s.editable"
        class="m-0 min-w-0 space-y-3 border-0 p-0"
      >
        <legend class="mb-2 p-0 font-medium">
          {{ text(s.firstSetup ? 'firstSettings' : 'settings') }}
        </legend>
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
      <p
        v-if="s.firstSetup"
        class="m-0 text-xs leading-5 text-muted-foreground"
      >
        {{
          text('gpuSuggestion', {
            gpu: s.gpuSuggestion,
            models: s.state.draft.models.join(', ') || text('noWorkflowModels')
          })
        }}
      </p>
      <p
        v-if="s.firstSetup"
        class="m-0 text-xs leading-5 text-muted-foreground"
      >
        {{ text('firstStorageEstimate') }}
      </p>
    </div>
    <div class="space-y-5">
      <section class="space-y-2 rounded-lg border border-border-default p-4">
        <h3 class="m-0 font-medium">{{ text('cost') }}</h3>
        <p class="m-0 text-xs">{{ text('gpuCost', { rate: gpuRate }) }}</p>
        <p class="m-0 text-xs">
          {{
            text('storageCost', {
              size: s.state.draft.storage,
              estimate: (s.state.draft.storage * 0.07).toFixed(2)
            })
          }}
        </p>
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{ text('sampleRates') }}
        </p>
        <p class="m-0 text-xs text-muted-foreground">{{ text('noTier') }}</p>
      </section>
      <section class="space-y-2">
        <h3 class="m-0 font-medium">{{ text('changes') }}</h3>
        <p v-for="id in s.changes" :key="id" class="m-0 text-xs leading-5">
          {{
            text('changeLine', {
              name: name(id),
              before: s.target.packs[id] ?? text('absent'),
              after: s.state.draft.packs[id] ?? text('removed')
            })
          }}
        </p>
        <p v-if="!s.changes.length" class="m-0 text-xs text-muted-foreground">
          {{ text('noChanges') }}
        </p>
      </section>
    </div>
  </div>
</template>
