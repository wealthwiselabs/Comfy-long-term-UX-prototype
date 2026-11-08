<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import Tooltip from '../../components/Tooltip.vue'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
</script>
<template>
  <Tooltip
    :text="
      t(
        s.canManageExtensions
          ? 'extensionPrototype.title'
          : 'extensionPrototype.extensionsDisabled'
      )
    "
  >
    <span
      :tabindex="!s.canManageExtensions ? 0 : undefined"
      class="inline-flex"
    >
      <Button
        variant="secondary"
        size="icon"
        data-testid="extension-manager-open"
        :aria-label="t('extensionPrototype.title')"
        :disabled="!s.editable || !s.canManageExtensions"
        @click="s.edit()"
        ><i class="icon-[comfy--extensions-blocks] size-4"
      /></Button>
    </span>
  </Tooltip>
</template>
