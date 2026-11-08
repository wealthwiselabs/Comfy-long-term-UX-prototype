<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { computeCatalogFixture, modelEntry } from './catalog'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t, n } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const name = (id: string) =>
  policyCatalog.find((pack) => pack.id === id)?.name ?? id
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
      <label class="block text-xs"
        >{{ text('name')
        }}<input
          v-model="s.state.draft.name"
          :disabled="!s.editable"
          class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2"
      /></label>
      <fieldset
        class="m-0 min-w-0 space-y-2 border-0 p-0"
        :disabled="!s.editable"
      >
        <legend class="mb-2 p-0 font-medium">{{ text('gpu') }}</legend>
        <label
          v-for="gpu in computeCatalogFixture"
          :key="gpu.gpuClass"
          class="flex items-center gap-3 rounded-lg border border-border-subtle p-3"
          ><input
            v-model="s.state.draft.gpu"
            type="radio"
            class="size-4 appearance-auto"
            :value="gpu.gpuClass"
            :aria-label="text('gpuOption', gpu)"
          /><span class="min-w-0 flex-1 text-sm"
            >{{ gpu.label
            }}<span class="mt-1 block text-xs text-muted-foreground">{{
              text('gpuMemory', { size: gpu.vramGb })
            }}</span></span
          ><span class="text-right text-xs"
            >{{ text('gpuHourly', { rate: gpu.pricePerHourUsd.toFixed(2) })
            }}<span class="mt-1 block text-muted-foreground">{{
              text('gpuSecondly', {
                rate: (gpu.pricePerHourUsd / 3600).toFixed(6)
              })
            }}</span></span
          ></label
        >
      </fieldset>
      <p
        v-if="!s.selectedGpu"
        role="alert"
        class="m-0 text-xs text-node-stroke-error"
      >
        {{ text('unknownGpu') }}
      </p>
      <p
        v-if="s.firstSetup"
        class="m-0 text-xs leading-5 text-muted-foreground"
      >
        {{
          text('gpuSuggestion', {
            gpu: s.gpuSuggestion?.label ?? text('unknownGpu'),
            models:
              s.state.draft.models
                .map((value) => modelEntry(value).name)
                .join(', ') || text('noWorkflowModels')
          })
        }}
      </p>
    </div>
    <div class="space-y-5">
      <section
        v-if="s.requestPending && s.requestNote"
        class="space-y-2 rounded-lg bg-secondary-background p-4"
      >
        <h3 class="m-0 text-sm font-medium">
          {{ text('requestNoteHeading') }}
        </h3>
        <p class="m-0 text-sm whitespace-pre-wrap">{{ s.requestNote }}</p>
      </section>
      <section class="space-y-3 rounded-lg border border-border-default p-4">
        <h3 class="m-0 font-medium">{{ text('cost') }}</h3>
        <div class="space-y-2">
          <h4 class="m-0 text-sm font-medium">{{ text('storage') }}</h4>
          <p class="m-0 text-sm">
            {{
              text(
                s.packageStorage.unknownCount
                  ? 'storageLowerBound'
                  : 'storageKnown',
                { size: s.packageStorage.knownGb.toFixed(2) }
              )
            }}
          </p>
          <p class="m-0 text-sm font-medium">
            {{
              s.packageStorage.monthlyUsd === null
                ? text('costUnavailable')
                : text(
                    s.packageStorage.unknownCount
                      ? 'storageMonthlyLowerBound'
                      : 'storageMonthly',
                    {
                      cost: n(Number(s.packageStorage.monthlyUsd.toFixed(6)), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })
                    }
                  )
            }}
          </p>
          <p
            v-if="s.packageStorage.unknownCount"
            class="m-0 text-xs text-muted-foreground"
          >
            {{
              text('unknownPackageCount', {
                count: s.packageStorage.unknownCount
              })
            }}
          </p>
        </div>
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{ text('packageSizeFixture') }}
        </p>
      </section>
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="m-0 text-sm font-medium">{{ text('modelStep') }}</h3>
          <Button
            v-if="s.canAddModels"
            variant="muted-textonly"
            size="sm"
            @click="s.panel = 'models'"
            >{{ text('editModels') }}</Button
          >
        </div>
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{
            s.state.draft.models
              .map((value) => modelEntry(value).name)
              .join(', ') || text('noModelsSelected')
          }}
        </p>
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
