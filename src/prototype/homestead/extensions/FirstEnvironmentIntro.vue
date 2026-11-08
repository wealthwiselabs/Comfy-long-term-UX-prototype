<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
const { t } = useI18n()
</script>
<template>
  <div class="space-y-7 px-6 pt-7 pb-6">
    <div class="flex flex-col items-center gap-4 text-center">
      <div
        class="flex size-14 items-center justify-center rounded-2xl bg-secondary-background"
      >
        <i
          class="icon-[lucide--cloud-lightning] size-8 text-primary-background"
        />
      </div>
      <h3 class="m-0 text-2xl leading-8 font-semibold text-base-foreground">
        {{ t('extensionPrototype.introValue') }}
      </h3>
      <p class="m-0 max-w-sm text-sm leading-6 text-muted-foreground">
        {{ t('extensionPrototype.introPacks') }}
      </p>
    </div>
    <div class="space-y-1 text-center">
      <p class="m-0 text-xs leading-5 text-muted-foreground">
        {{ t('extensionPrototype.introBilling') }}
      </p>
      <Button
        as="a"
        href="https://comfy.org/pricing"
        target="_blank"
        rel="noopener noreferrer"
        variant="link"
        size="sm"
        >{{ t('extensionPrototype.learnMore') }}</Button
      >
    </div>
  </div>
</template>
