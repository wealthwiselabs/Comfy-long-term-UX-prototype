<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { useSkillFlowStore } from './skillFlowStore'
const flow = useSkillFlowStore()
const { t } = useI18n()
</script>
<template>
  <section class="space-y-4 rounded-xl border border-border-subtle p-4">
    <h3 class="text-sm font-medium">
      {{ t('homestead.skillFlow.uploadTitle') }}
    </h3>
    <p class="text-xs leading-5 text-muted-foreground">
      {{
        t('homestead.skillFlow.uploadBody', {
          workspace: flow.session?.workspace
        })
      }}
    </p>
    <div
      v-for="kind in ['model', 'asset'] as const"
      :key="kind"
      class="space-y-3"
    >
      <template v-if="flow.pendingFiles.some((file) => file.kind === kind)">
        <ul class="space-y-3">
          <li
            v-for="file in flow.pendingFiles.filter(
              (item) => item.kind === kind
            )"
            :key="file.name"
            class="space-y-1 border-l-2 border-border-subtle pl-3"
          >
            <p class="text-xs font-medium wrap-anywhere">
              {{ file.name }} · {{ file.size }}
            </p>
            <p class="text-xs leading-5 text-muted-foreground">
              {{ t(`homestead.skillFlow.fileReason.${file.reason}`) }}
            </p>
            <p class="text-xs leading-5 text-muted-foreground">
              {{ t(`homestead.skillFlow.destination.${file.kind}`) }}
            </p>
          </li>
        </ul>
        <Button variant="inverted" @click="flow.approveUploads(kind)">{{
          t(
            kind === 'model'
              ? 'homestead.skillFlow.uploadModels'
              : 'homestead.uploadAssets'
          )
        }}</Button>
      </template>
    </div>
    <p
      v-if="flow.approvedFiles.length"
      class="text-xs leading-5 text-muted-foreground"
    >
      {{
        t('homestead.skillFlow.approvedFiles', {
          files: flow.approvedFiles.join(', ')
        })
      }}
    </p>
    <Button variant="secondary" @click="flow.declineUploads">{{
      t('homestead.cancelUpload')
    }}</Button>
  </section>
</template>
