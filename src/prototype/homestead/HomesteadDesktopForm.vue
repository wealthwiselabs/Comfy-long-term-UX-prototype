<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { localAgentPrompt } from './agentModel'
import { useHomesteadStore } from './store'
const s = useHomesteadStore()
const { t } = useI18n()
async function copy() {
  try {
    await navigator.clipboard.writeText(
      localAgentPrompt(s.active, s.workspaceName)
    )
    s.flash(t('homestead.copied'))
  } catch {
    s.flash(t('homestead.copyFailed'))
  }
}
</script>
<template>
  <div class="space-y-5">
    <div class="flex justify-end gap-2">
      <Button variant="textonly" @click="s.dialog = null">{{
        t('homestead.cancel')
      }}</Button>
      <Button
        variant="inverted"
        :disabled="s.build.phase === 'building'"
        @click="s.startAgentHandoff()"
        >{{ t('homestead.letsGo') }}</Button
      >
    </div>
    <details class="text-xs text-muted-foreground">
      <summary class="cursor-pointer">
        {{ t('homestead.otherAgentOptions') }}
      </summary>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" @click="copy">{{
          t('homestead.copy')
        }}</Button>
        <a
          href="https://platform.comfy.org"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center rounded-lg px-3 py-2 underline underline-offset-4"
          >{{ t('homestead.openPlatform') }}</a
        >
      </div>
    </details>
  </div>
</template>
