<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { policyCatalog } from '../../fixtures/policyCatalog'
import { useExtensionManagerStore } from './store'
const { open } = defineProps<{ open: boolean }>()
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const github = ref('')
const error = ref('')
const customSources = computed(() =>
  Object.keys(s.state.draft.packs).filter(
    (id) => !policyCatalog.some((pack) => pack.id === id)
  )
)
function addGithub() {
  if (!s.editable) return
  const value = github.value.trim()
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(value)) {
    error.value = text('invalidGithub')
    return
  }
  s.state.draft.packs[value] = 'demo'
  github.value = ''
  error.value = ''
}
function acceptFiles(files: FileList) {
  if (!s.editable) return
  const names = Array.from(files, (file) => file.name.trim())
  const invalid = names.filter((name) => !/^[^/\\]+\.zip$/i.test(name))
  names
    .filter((name) => /^[^/\\]+\.zip$/i.test(name))
    .forEach((name) => {
      s.state.draft.packs[name] = 'demo'
    })
  error.value = invalid.length
    ? text('invalidZip', { names: invalid.join(', ') })
    : ''
}
function browseFiles(event: Event) {
  if (!(event.target instanceof HTMLInputElement) || !event.target.files) return
  acceptFiles(event.target.files)
  event.target.value = ''
}
function dropFiles(event: DragEvent) {
  if (event.dataTransfer) acceptFiles(event.dataTransfer.files)
}
</script>
<template>
  <div v-if="open || customSources.length" class="space-y-3">
    <section
      v-if="open"
      id="extension-pack-sources"
      class="space-y-2 rounded-lg border border-border-subtle p-3"
      :aria-label="text('source')"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="block text-xs"
            >{{ text('github')
            }}<input
              v-model="github"
              :disabled="!s.editable"
              :placeholder="text('githubPlaceholder')"
              class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2" /></label
          ><Button
            size="sm"
            variant="secondary"
            :disabled="!s.editable"
            @click="addGithub"
            >{{ text('addGithub') }}</Button
          >
        </div>
        <div
          data-extension-source-drop
          role="group"
          :aria-label="text('zipDropZone')"
          class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default bg-secondary-background p-3 text-center focus-within:outline-2 focus-within:outline-offset-2"
          @dragover.prevent.stop
          @drop.prevent.stop="dropFiles"
        >
          <p class="m-0 text-xs">{{ text('dropZip') }}</p>
          <Button
            as="label"
            for="extension-zip-file"
            size="sm"
            variant="secondary"
            class="cursor-pointer"
            :aria-disabled="!s.editable"
            >{{ text('browseZip') }}</Button
          ><input
            id="extension-zip-file"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            multiple
            class="sr-only"
            :disabled="!s.editable"
            @change="browseFiles"
          />
        </div>
      </div>
      <p class="m-0 text-xs leading-5 text-muted-foreground">
        {{ text('sourceHint') }}
      </p>
      <p v-if="error" role="alert" class="m-0 text-xs text-node-stroke-error">
        {{ error }}
      </p>
    </section>
    <div
      v-if="customSources.length"
      class="flex flex-wrap gap-2"
      role="group"
      :aria-label="text('customAdded')"
    >
      <span
        v-for="source in customSources"
        :key="source"
        class="flex max-w-full items-center gap-2 rounded-sm bg-secondary-background py-1 pr-1 pl-2 text-xs"
        ><span class="truncate">{{ source }}</span
        ><Button
          size="icon-sm"
          variant="muted-textonly"
          :aria-label="text('removeSource', { name: source })"
          :disabled="!s.editable"
          @click="delete s.state.draft.packs[source]"
          ><i class="icon-[lucide--x] size-3" /></Button
      ></span>
    </div>
  </div>
</template>
