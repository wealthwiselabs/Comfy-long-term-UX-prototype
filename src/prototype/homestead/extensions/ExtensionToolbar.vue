<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { canRun } from './model'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
function seedJobs() {
  s.run(s.state.targetId)
  s.run(s.state.targetId)
}
</script>
<template>
  <div
    class="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-border-subtle bg-base-background px-4 py-2 text-base-foreground"
  >
    <span class="flex items-center gap-2 text-sm"
      ><i class="icon-[lucide--cloud] size-4" />{{ text('cloud') }}</span
    >
    <span class="text-xs text-muted-foreground">{{
      s.scenario === 'first'
        ? text('standardCloud')
        : text('environment', s.selectedEnvironment)
    }}</span>
    <Button size="sm" variant="secondary" @click="s.edit()"
      ><i class="icon-[lucide--blocks] size-4" />{{ text('title') }}</Button
    >
    <Button size="sm" variant="muted-textonly" @click="s.panel = 'status'"
      ><span role="status">{{
        text(`status${s.state.phase[0].toUpperCase()}${s.state.phase.slice(1)}`)
      }}</span></Button
    >
    <span v-if="s.locked" class="text-xs text-muted-foreground">{{
      text('runLocked')
    }}</span>
    <details class="ml-auto max-w-lg text-xs">
      <summary class="cursor-pointer text-muted-foreground">
        {{ text('demo') }}
      </summary>
      <div
        class="absolute top-12 right-4 z-50 max-h-[75vh] w-96 space-y-3 overflow-auto rounded-xl border border-border-default bg-base-background p-4 shadow-lg"
      >
        <p class="font-medium">{{ text('prototype') }}</p>
        <p class="text-muted-foreground">{{ text('demoHint') }}</p>
        <label class="flex items-center gap-2"
          >{{ text('scenario')
          }}<select
            :value="s.scenario"
            class="rounded-sm border border-border-default bg-base-background p-2"
            @change="
              s.reset(
                ($event.target as HTMLSelectElement).value === 'first'
                  ? 'first'
                  : ($event.target as HTMLSelectElement).value === 'member'
                    ? 'member'
                    : 'existing'
              )
            "
          >
            <option value="existing">{{ text('existing') }}</option>
            <option value="first">{{ text('first') }}</option>
            <option value="member">{{ text('member') }}</option>
          </select></label
        >
        <p>{{ text('role', { role: s.role }) }}</p>
        <label class="flex gap-2"
          ><input
            v-model="s.failure"
            type="checkbox"
            class="size-4 appearance-auto"
          />{{ text('failureToggle') }}</label
        >
        <label class="flex gap-2"
          ><input
            v-model="s.holdJobs"
            type="checkbox"
            class="size-4 appearance-auto"
          />{{ text('holdJobs') }}</label
        >
        <div class="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            :disabled="!canRun(s.state, s.state.targetId)"
            @click="seedJobs"
            >{{ text('seedJobs') }}</Button
          ><Button
            size="sm"
            variant="secondary"
            @click="s.dispatch({ type: 'finishJob' })"
            >{{ text('finishJob') }}</Button
          >
        </div>
        <div class="border-t border-border-subtle pt-3">
          <p class="mb-2 font-medium">
            {{ text('inbox', { count: s.inbox.length }) }}
          </p>
          <p v-if="!s.inbox.length" class="text-muted-foreground">
            {{ text('emptyInbox') }}
          </p>
          <article
            v-for="(email, index) in s.inbox"
            :key="index"
            class="mb-3 space-y-2 rounded-lg border border-border-subtle p-3"
          >
            <p class="font-medium">{{ text(`${email.kind}Subject`) }}</p>
            <p>{{ text('emailTo', { recipients: email.recipients }) }}</p>
            <p class="text-muted-foreground">
              {{
                text(
                  email.kind === 'available'
                    ? 'availableMessage'
                    : `${email.kind}Email`
                )
              }}
            </p>
            <Button
              size="sm"
              variant="secondary"
              @click="
                email.kind === 'request'
                  ? s.reviewRequest()
                  : (s.panel = 'status')
              "
              >{{
                text(
                  email.kind === 'request'
                    ? 'reviewRequest'
                    : email.kind === 'failed'
                      ? 'recoverEmail'
                      : email.kind === 'available'
                        ? 'availableEmail'
                        : 'reviewEmail'
                )
              }}</Button
            >
          </article>
        </div>
      </div>
    </details>
  </div>
</template>
