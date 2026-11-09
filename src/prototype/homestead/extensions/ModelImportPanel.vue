<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import {
  importFilename,
  isModelDirectory,
  isModelFilename,
  modelImportUrl
} from './modelImport'
import { useExtensionManagerStore } from './store'
const emit = defineEmits<{ close: [] }>()
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
const mode = ref<'file' | 'url'>('file')
const url = ref('')
const filename = ref('')
const touched = ref(false)
const file = ref<File | null>(null)
const folder = ref('')
const customFolder = ref('')
const error = ref('')
const directory = computed(() =>
  folder.value === 'other' ? customFolder.value.trim() : folder.value
)
const canAdd = computed(
  () =>
    s.editable &&
    s.canAddModels &&
    isModelDirectory(directory.value) &&
    (mode.value === 'file'
      ? !!file.value && file.value.size > 0 && isModelFilename(file.value.name)
      : !!modelImportUrl(url.value) && isModelFilename(filename.value.trim()))
)
watch(url, (value) => {
  if (!touched.value) filename.value = importFilename(value)
})
function setMode(source: 'file' | 'url') {
  mode.value = source
  error.value = ''
}
function chooseFiles(files: FileList | File[]) {
  if (!s.editable || !s.canAddModels) return
  if (files.length !== 1) {
    error.value = 'modelImportSingleError'
    return
  }
  const next = files[0]
  if (!isModelFilename(next.name)) {
    error.value = 'modelImportFilenameError'
    return
  }
  if (next.size <= 0) {
    error.value = 'modelImportEmptyError'
    return
  }
  file.value = next
  error.value = ''
}
function browse(event: Event) {
  if (!(event.target instanceof HTMLInputElement) || !event.target.files) return
  chooseFiles(event.target.files)
  event.target.value = ''
}
function drop(event: DragEvent) {
  if (event.dataTransfer) chooseFiles(event.dataTransfer.files)
}
function add() {
  if (!canAdd.value) return
  const failure = s.addModelImport({
    mode: mode.value,
    filename: filename.value,
    directory: directory.value,
    url: url.value,
    file: file.value
  })
  if (failure) {
    error.value = failure
    return
  }
  emit('close')
}
</script>
<template>
  <section
    id="extension-model-import"
    class="space-y-3 rounded-lg border border-border-default bg-secondary-background p-4"
    :aria-label="text('modelImportTitle')"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 class="m-0 text-sm font-medium">{{ text('modelImportTitle') }}</h3>
      <Button
        size="icon-sm"
        variant="muted-textonly"
        :aria-label="text('modelImportClose')"
        @click="emit('close')"
        ><i class="icon-[lucide--x] size-4"
      /></Button>
    </div>
    <p class="m-0 text-xs leading-5 text-muted-foreground">
      {{ text('modelImportSimulation') }}
    </p>
    <div
      role="group"
      :aria-label="text('modelImportSource')"
      class="flex gap-2"
    >
      <Button
        v-for="source in ['file', 'url'] as const"
        :key="source"
        size="sm"
        :variant="mode === source ? 'secondary' : 'muted-textonly'"
        :aria-pressed="mode === source"
        @click="setMode(source)"
        >{{ text(`modelImportModes.${source}`) }}</Button
      >
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-if="mode === 'file'"
        role="group"
        :aria-label="text('modelDropZone')"
        class="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default bg-base-background p-3 text-center"
        @dragover.prevent.stop
        @drop.prevent.stop="drop"
      >
        <p class="m-0 max-w-full truncate text-xs">
          {{ file?.name ?? text('modelDropFile') }}
        </p>
        <label
          class="cursor-pointer rounded-lg border border-border-default px-3 py-2 text-xs focus-within:outline-2"
          >{{ text('modelBrowseFile')
          }}<input
            type="file"
            class="sr-only"
            :aria-label="text('modelBrowseFile')"
            :disabled="!s.editable || !s.canAddModels"
            @change="browse"
        /></label>
        <p class="m-0 text-xs text-muted-foreground">
          {{ text('modelFileFormats') }}
        </p>
      </div>
      <div v-else class="space-y-3">
        <label class="block text-xs"
          >{{ text('modelImportUrl')
          }}<input
            v-model="url"
            type="url"
            class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2"
            :placeholder="text('modelUrlPlaceholder')"
            :aria-invalid="!!url.trim() && !modelImportUrl(url)"
            :disabled="!s.editable || !s.canAddModels"
        /></label>
        <p
          v-if="url.trim() && !modelImportUrl(url)"
          role="alert"
          class="m-0 text-xs text-node-stroke-error"
        >
          {{ text('modelImportUrlError') }}
        </p>
        <label class="block text-xs"
          >{{ text('modelImportFilename')
          }}<input
            v-model="filename"
            class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2"
            :aria-invalid="
              !!filename.trim() && !isModelFilename(filename.trim())
            "
            :disabled="!s.editable || !s.canAddModels"
            @input="touched = true"
        /></label>
        <p
          v-if="filename.trim() && !isModelFilename(filename.trim())"
          role="alert"
          class="m-0 text-xs text-node-stroke-error"
        >
          {{ text('modelImportFilenameError') }}
        </p>
      </div>
      <div class="space-y-3">
        <label class="block text-xs"
          >{{ text('modelImportFolder')
          }}<select
            v-model="folder"
            class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2"
            :disabled="!s.editable || !s.canAddModels"
          >
            <option value="" disabled>{{ text('modelSelectFolder') }}</option>
            <option
              v-for="value in [
                'checkpoints',
                'diffusion_models',
                'loras',
                'text_encoders',
                'vae',
                'controlnet',
                'upscale_models'
              ]"
              :key="value"
              :value="value"
            >
              {{ value }}
            </option>
            <option value="other">{{ text('modelOtherFolder') }}</option>
          </select></label
        >
        <label v-if="folder === 'other'" class="block text-xs"
          >{{ text('modelCustomFolder')
          }}<input
            v-model="customFolder"
            class="mt-1 w-full rounded-sm border border-border-default bg-base-background p-2"
            :aria-invalid="!!customFolder && !isModelDirectory(directory)"
            :disabled="!s.editable || !s.canAddModels"
        /></label>
        <p class="m-0 text-xs leading-5 text-muted-foreground">
          {{ text('modelFolderHint') }}
        </p>
        <p
          v-if="
            folder === 'other' && customFolder && !isModelDirectory(directory)
          "
          role="alert"
          class="m-0 text-xs text-node-stroke-error"
        >
          {{ text('modelImportFolderError') }}
        </p>
      </div>
    </div>
    <p v-if="error" role="alert" class="m-0 text-xs text-node-stroke-error">
      {{ text(error) }}
    </p>
    <div class="flex justify-end gap-2">
      <Button size="sm" variant="muted-textonly" @click="emit('close')">{{
        text('modelImportCancel')
      }}</Button
      ><Button size="sm" variant="secondary" :disabled="!canAdd" @click="add">{{
        text('modelImportAdd')
      }}</Button>
    </div>
  </section>
</template>
