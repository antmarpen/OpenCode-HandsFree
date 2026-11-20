import { createSignal, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import { listOutputDevices } from "../audio/devices"
import { Voice } from "../contract"
import type { definition } from "../definition"
import { ProviderRow } from "./provider-row"
import { useCloudProviders, useModelNames } from "./providers"
import { EngineRow, NumberRow, SecretRow, SwitchRow, TextRow, type EngineOption } from "./rows"
import type { SecretState } from "./secrets"
import { SuggestionRow } from "./suggestion-row"
import { useSpeech } from "../window/speech"

/** Settings section for text-to-voice, including the test button. */
export function OutputSection(props: { readonly secrets: SecretState }) {
  const ctx = usePlugin<typeof definition>()
  const speech = useSpeech()
  const settings = () => ctx.stores.settings.value
  const providers = useCloudProviders()
  const modelNames = useModelNames()
  const [testing, setTesting] = createSignal(false)

  const providerBaseURL = (providerID: string) =>
    providers.find((item) => item.id === providerID)?.baseURL

  const engines = (): EngineOption[] => [
    { value: "local", label: ctx.t("settings.engine.local") },
    { value: "cloud", label: ctx.t("settings.engine.cloud") },
  ]

  const test = async () => {
    setTesting(true)
    try {
      await speech.speak(ctx.t("settings.test.text"), `test:${Date.now()}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <ctx.ui.SettingsSection title={ctx.t("settings.section.output")}>
      <EngineRow
        id="voice-engine-output"
        title={ctx.t("settings.engine")}
        value={settings().outputEngine}
        options={engines()}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.outputEngine = value
          })
        }
      />

      <SuggestionRow
        id="voice-output-device"
        title={ctx.t("settings.outputDevice")}
        description={ctx.t("settings.outputDevice.description")}
        placeholder={ctx.t("settings.outputDevice.default")}
        value={settings().speak.outputDevice}
        loadLabel={ctx.t("settings.outputDevice.load")}
        emptyLabel={ctx.t("settings.noOutputDevices")}
        eager
        load={async () => [
          { value: "", label: ctx.t("settings.outputDevice.default") },
          ...(await listOutputDevices(ctx.t("settings.outputDevice.fallback"))),
        ]}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.speak.outputDevice = value
          })
        }
      />

      <Show when={settings().outputEngine === "local"}>
        <SwitchRow
          id="voice-speak-local"
          title={ctx.t("settings.localEnabled")}
          description={ctx.t("settings.localEnabled.description")}
          checked={settings().speak.localEnabled}
          onChange={(value) =>
            ctx.stores.settings.update((draft) => {
              draft.speak.localEnabled = value
            })
          }
        />

        <Show when={settings().speak.localEnabled}>
          <SuggestionRow
            id="voice-speak-voice"
            title={ctx.t("settings.voice")}
            description={ctx.t("settings.voice.description")}
            placeholder={ctx.t("settings.selectVoice")}
            value={settings().speak.localVoice}
            loadLabel={ctx.t("settings.voices.load")}
            load={() =>
              ctx.main(Voice)
                .voices()
                .then((result) => result.voices.map((voice) => ({ value: voice, label: voice })))
            }
            onChange={(value) =>
              ctx.stores.settings.update((draft) => {
                draft.speak.localVoice = value
              })
            }
          />
          <NumberRow
            id="voice-speak-rate"
            title={ctx.t("settings.rate")}
            description={ctx.t("settings.rate.description")}
            value={settings().speak.localRate}
            onChange={(value) =>
              ctx.stores.settings.update((draft) => {
                draft.speak.localRate = value
              })
            }
          />
        </Show>
      </Show>

      <Show when={settings().outputEngine === "cloud"}>
        <ProviderRow
          id="voice-speak-provider"
          value={settings().speak.provider}
          onChange={(provider, baseURL) =>
            ctx.stores.settings.update((draft) => {
              draft.speak.provider = provider
              draft.speak.cloudModel = ""
              if (baseURL) draft.speak.cloudURL = baseURL
            })
          }
        />

        <Show
          when={
            !settings().speak.provider ||
            !providerBaseURL(settings().speak.provider)
          }
        >
          <TextRow
            id="voice-speak-url"
            title={ctx.t("settings.url")}
            description={ctx.t("settings.url.description")}
            placeholder="https://api.openai.com/v1"
            type="url"
            value={settings().speak.cloudURL}
            onChange={(value) =>
              ctx.stores.settings.update((draft) => {
                draft.speak.cloudURL = value
              })
            }
          />
        </Show>

        <Show when={!settings().speak.provider}>
          <SecretRow
            id="voice-key-speak"
            title={ctx.t("settings.apiKey")}
            description={ctx.t("settings.apiKey.description")}
            configured={props.secrets.configured("speak")}
            value={props.secrets.value("speak")}
            onChange={(value) => props.secrets.setValue("speak", value)}
            onSave={() => props.secrets.save("speak")}
            onRemove={() => props.secrets.remove("speak")}
          />
        </Show>

        <SuggestionRow
          id="voice-speak-model"
          title={ctx.t("settings.model")}
          description={ctx.t("settings.model.description")}
          placeholder={ctx.t("settings.selectModel")}
          value={settings().speak.cloudModel}
          loadLabel={ctx.t("settings.models.load")}
          resetKey={`${settings().speak.provider}|${settings().speak.cloudURL}`}
          load={() =>
            ctx.main(Voice)
              .models({
                slot: "speak",
                url: settings().speak.cloudURL,
                providerID: settings().speak.provider || undefined,
              })
              .then((result) =>
                result.models.map((model) => ({
                  value: model.id,
                  label:
                    modelNames(settings().speak.provider, model.id) ?? model.name ?? model.id,
                })),
              )
          }
          onChange={(value) =>
            ctx.stores.settings.update((draft) => {
              draft.speak.cloudModel = value
            })
          }
        />

        <TextRow
          id="voice-speak-cloud-voice"
          title={ctx.t("settings.voice")}
          description={ctx.t("settings.voice.description")}
          placeholder="alloy"
          value={settings().speak.cloudVoice}
          onChange={(value) =>
            ctx.stores.settings.update((draft) => {
              draft.speak.cloudVoice = value
            })
          }
        />

        <TextRow
          id="voice-speak-format"
          title={ctx.t("settings.format")}
          description={ctx.t("settings.format.description")}
          placeholder="wav"
          value={settings().speak.format}
          onChange={(value) =>
            ctx.stores.settings.update((draft) => {
              draft.speak.format = value
            })
          }
        />
      </Show>

      <SwitchRow
        id="voice-default-output"
        title={ctx.t("settings.defaultOutput")}
        description={ctx.t("settings.defaultOutput.description")}
        checked={settings().defaultOutput}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.defaultOutput = value
          })
        }
      />

      <ctx.ui.SettingsRow
        id="voice-test"
        title={ctx.t("settings.test")}
        description={ctx.t("settings.test.description")}
      >
        <ctx.ui.Button variant="neutral" busy={testing()} onClick={() => void test()}>
          {ctx.t("settings.test")}
        </ctx.ui.Button>
      </ctx.ui.SettingsRow>
    </ctx.ui.SettingsSection>
  )
}
