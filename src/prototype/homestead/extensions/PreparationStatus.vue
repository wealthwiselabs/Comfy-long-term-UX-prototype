<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { preparationStages } from './preparation'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
function status(index: number) {
  if (s.state.phase === 'failed' && index === s.preparationStep) return 'failed'
  if (
    ['ready', 'waiting', 'applying', 'updated'].includes(s.state.phase) ||
    index < s.preparationStep
  )
    return 'completed'
  return s.state.phase === 'preparing' && index === s.preparationStep
    ? 'current'
    : 'pending'
}
</script>
<template>
  <section
    v-if="s.state.phase !== 'idle'"
    class="space-y-4"
    :aria-label="text('preparationStages')"
  >
    <p class="m-0 text-xs leading-5 text-muted-foreground">
      {{ text('preparationSimulation') }}
    </p>
    <div
      v-for="section in ['build', 'deploy']"
      :key="section"
      class="space-y-2"
    >
      <h3 class="m-0 text-sm font-medium">
        {{ text(`stageSections.${section}`) }}
      </h3>
      <ol class="m-0 space-y-2 p-0">
        <template v-for="(stage, index) in preparationStages" :key="stage.id"
          ><li
            v-if="stage.section === section"
            :aria-label="text(`stages.${stage.id}`)"
            :data-platform-phases="stage.phases.join(',')"
            class="flex items-center gap-3 rounded-lg border border-border-subtle p-3 text-xs"
          >
            <i
              v-if="status(index) === 'completed'"
              class="icon-[lucide--circle-check] size-4 shrink-0"
            /><i
              v-else-if="status(index) === 'current'"
              class="icon-[lucide--loader-circle] size-4 shrink-0 animate-spin"
            /><i
              v-else-if="status(index) === 'failed'"
              class="icon-[lucide--circle-alert] size-4 shrink-0 text-node-stroke-error"
            /><i
              v-else
              class="icon-[lucide--circle] size-4 shrink-0 text-muted-foreground"
            /><span class="flex-1">{{ text(`stages.${stage.id}`) }}</span
            ><span class="text-muted-foreground">{{
              text(`stageStatus.${status(index)}`)
            }}</span>
          </li></template
        >
      </ol>
    </div>
  </section>
</template>
