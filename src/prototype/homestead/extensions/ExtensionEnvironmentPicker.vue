<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DropdownMenuItemIndicator, DropdownMenuRadioGroup } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuRadioItem from '@/components/ui/menu/MenuRadioItem.vue'
import { useHomesteadStore } from '../store'
import { useExtensionManagerStore } from './store'

const s = useExtensionManagerStore()
const homestead = useHomesteadStore()
const open = ref(false)
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const current = computed(() => homestead.environment)
const switching = computed(() => s.state.phase === 'applying')
const rows = computed(() => {
  const rank = (id: string) =>
    id === current.value.id ? 0 : id === 'dep-comfy-cloud' ? 1 : 2
  return [...s.availableEnvironments].sort((a, b) => rank(a.id) - rank(b.id))
})
function choose(id: string) {
  s.selectEnvironment(id)
  open.value = false
}
</script>

<template>
  <Menu
    v-model:open="open"
    :modal="false"
    :side-offset="8"
    :label="text('environmentPicker')"
    class="w-84"
  >
    <template #trigger>
      <Button
        variant="secondary"
        size="unset"
        class="group h-8 gap-1 rounded-lg pr-1.5 pl-2"
        :disabled="switching"
        :aria-label="text('environmentPickerTrigger', current)"
        :title="text('environmentPickerTrigger', current)"
        data-testid="extension-environment-picker"
      >
        <span class="relative flex">
          <i
            :class="
              cn(
                'size-4',
                current.id === 'dep-comfy-cloud'
                  ? 'icon-[lucide--cloud]'
                  : 'icon-[lucide--server]'
              )
            "
            aria-hidden="true"
          />
          <span
            v-if="current.id !== 'dep-comfy-cloud'"
            class="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-success-background ring-2 ring-secondary-background"
            aria-hidden="true"
          />
        </span>
        <i
          class="icon-[lucide--chevron-down] size-3 text-muted-foreground"
          aria-hidden="true"
        />
      </Button>
    </template>
    <DropdownMenuRadioGroup :model-value="current.id">
      <MenuRadioItem
        v-for="environment in rows"
        :key="environment.id"
        :value="environment.id"
        :disabled="switching"
        :aria-label="text('chooseEnvironment', environment)"
        class="gap-3 aria-checked:bg-secondary-background"
        @select="choose(environment.id)"
      >
        <span class="relative flex shrink-0">
          <i
            :class="
              cn(
                'size-4 text-muted-foreground',
                environment.id === 'dep-comfy-cloud'
                  ? 'icon-[lucide--cloud]'
                  : 'icon-[lucide--server]'
              )
            "
            aria-hidden="true"
          />
          <span
            v-if="environment.id !== 'dep-comfy-cloud'"
            class="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-success-background ring-1 ring-base-background"
            aria-hidden="true"
          />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ environment.name }}</span>
        <span
          v-if="environment.id !== 'dep-comfy-cloud'"
          class="text-xs text-muted-foreground"
          >{{ text('environmentPickerVersion', environment) }}</span
        >
        <span class="flex size-4 shrink-0">
          <DropdownMenuItemIndicator>
            <i class="icon-[lucide--check] size-4" aria-hidden="true" />
          </DropdownMenuItemIndicator>
        </span>
      </MenuRadioItem>
    </DropdownMenuRadioGroup>
  </Menu>
</template>
