<script setup lang="ts">
import { ref } from 'vue'
import { PopoverClose, PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { canRun } from './model'
import { useExtensionManagerStore } from './store'
const s = useExtensionManagerStore()
const demoOpen = ref(false)
const { t } = useI18n()
const text = (key: string, values = {}) =>
  t(`extensionPrototype.${key}`, values)
function seedJobs() {
  s.run(s.state.targetId)
  s.run(s.state.targetId)
}
function selectScenario(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  demoOpen.value = false
  s.reset(
    event.target.value === 'first'
      ? 'first'
      : event.target.value === 'member'
        ? 'member'
        : 'existing'
  )
}
function followEmail(email: (typeof s.inbox)[number]) {
  demoOpen.value = false
  if (email.kind === 'request') s.reviewRequest()
  else s.panel = 'status'
}
function keepScenarioFocus(event: Event) {
  if (s.panel && s.panel !== 'status') event.preventDefault()
}
function configureCapability(key: 'addNodes' | 'addModels', event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  s.setEnterpriseCapabilities({
    ...s.enterpriseCapabilities,
    [key]: event.target.checked
  })
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
    <Button
      v-if="!['idle', 'updated'].includes(s.state.phase)"
      size="sm"
      variant="muted-textonly"
      @click="s.panel = 'status'"
      ><span role="status">{{
        text(
          s.requestPending && s.state.phase === 'idle'
            ? 'requestSent'
            : `status${s.state.phase[0].toUpperCase()}${s.state.phase.slice(1)}`
        )
      }}</span></Button
    >
    <span v-if="s.locked" class="text-xs text-muted-foreground">{{
      text('runLocked')
    }}</span>
    <div class="ml-auto text-xs">
      <Popover v-model:open="demoOpen" :modal="false">
        <PopoverTrigger as-child>
          <Button size="sm" variant="muted-textonly">{{ text('demo') }}</Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          :side-offset="8"
          :aria-label="text('demo')"
          class="max-h-[75vh] w-96 max-w-[calc(100vw-2rem)] space-y-3 overflow-auto rounded-xl border-border-default text-xs shadow-lg"
          @close-auto-focus="keepScenarioFocus"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="m-0 font-medium">{{ text('prototype') }}</p>
            <PopoverClose as-child>
              <Button
                size="icon-sm"
                variant="muted-textonly"
                :aria-label="text('demoClose')"
              >
                <i class="icon-[lucide--x] size-4" />
              </Button>
            </PopoverClose>
          </div>
          <p class="text-muted-foreground">{{ text('demoHint') }}</p>
          <label class="flex items-center gap-2"
            >{{ text('scenario')
            }}<select
              :value="s.scenario"
              class="rounded-sm border border-border-default bg-base-background p-2"
              @change="selectScenario"
            >
              <option value="existing">{{ text('existing') }}</option>
              <option value="first">{{ text('first') }}</option>
              <option value="member">{{ text('member') }}</option>
            </select></label
          >
          <p>{{ text('role', { role: s.role }) }}</p>
          <fieldset
            v-if="s.scenario === 'member'"
            class="m-0 space-y-2 rounded-lg border border-border-subtle p-3"
          >
            <legend class="px-1 font-medium">
              {{ text('enterpriseControls') }}
            </legend>
            <label class="flex gap-2"
              ><input
                type="checkbox"
                class="size-4 appearance-auto"
                :checked="s.enterpriseCapabilities.addNodes"
                @change="configureCapability('addNodes', $event)"
              />{{ text('allowAddNodes') }}</label
            >
            <label class="flex gap-2"
              ><input
                type="checkbox"
                class="size-4 appearance-auto"
                :checked="s.enterpriseCapabilities.addModels"
                @change="configureCapability('addModels', $event)"
              />{{ text('allowAddModels') }}</label
            >
          </fieldset>
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
              <p v-if="email.note" class="whitespace-pre-wrap">
                {{ email.note }}
              </p>
              <Button
                size="sm"
                variant="secondary"
                @click="followEmail(email)"
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
        </PopoverContent>
      </Popover>
    </div>
  </div>
</template>
