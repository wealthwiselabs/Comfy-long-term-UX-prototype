<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { skillScenarios } from './skillFlowModel'
import { useHomesteadStore } from './store'
const s = useHomesteadStore()
const { t } = useI18n()
function tryPath() {
  s.agentHandoff = null
  s.agentRun = null
  s.agentOpen = false
  s.dialog = 'desktop'
}
</script>
<template>
  <section
    :aria-label="t('homestead.skillFlow.demoPath')"
    class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle bg-secondary-background/30 px-4 py-3 text-base-foreground"
  >
    <label class="flex items-center gap-3 text-xs font-medium">
      <i class="icon-[lucide--git-branch] size-4 text-muted-foreground" />
      {{ t('homestead.skillFlow.demoPath') }}
      <select
        v-model="s.agentScenario"
        :aria-label="t('homestead.skillFlow.demoPath')"
        aria-describedby="hs-path-hint"
        class="h-9 max-w-72 rounded-lg border border-border-default bg-base-background px-3 text-xs"
      >
        <option v-for="kind in skillScenarios" :key="kind" :value="kind">
          {{ t(`homestead.skillFlow.scenarios.${kind}`) }}
        </option>
      </select>
    </label>
    <Button
      variant="secondary"
      size="sm"
      :disabled="s.build.phase === 'building'"
      @click="tryPath"
    >
      <i class="icon-[lucide--play] size-3.5" />
      {{ t('homestead.skillFlow.tryPath') }}
    </Button>
    <p
      id="hs-path-hint"
      class="min-w-48 flex-1 text-xs leading-5 text-muted-foreground"
    >
      {{ t(`homestead.skillFlow.pathHint.${s.agentScenario}`) }}
    </p>
  </section>
</template>
