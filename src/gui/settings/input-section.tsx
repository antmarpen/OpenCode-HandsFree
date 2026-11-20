import { Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import { listInputDevices } from "../audio/devices"
import { Voice } from "../contract"
import type { definition } from "../definition"
import { ProviderRow } from "./provider-row"
import { useCloudProviders, useModelNames } from "./providers"
import { EngineRow, SecretRow, SwitchRow, TextRow, type EngineOption } from "./rows"
import type { SecretState } from "./secrets"
import { SuggestionRow } from "./suggestion-row"

/** Settings section for voice-to-text. */
export function InputSection(props: { readonly secrets: SecretState }) {
  const ctx = usePlugin<typeof definition>()
  const settings = () => ctx.stores.settings.value
  const providers = useCloudProviders()
  const modelNames = useModelNames()

  const providerBaseURL = (providerID: string) =>
    providers.find((item) => item.id === providerID)?.baseURL

  const engines = (): EngineOption[] => [
    { value: "local", label: ctx.t("settings.engine.local") },
    { value: "cloud", label: ctx.t("settings.engine.cloud") },
  ]

  return (
    <ctx.ui.SettingsSection title={ctx.t("settings.section.input")}>
      <EngineRow
        id="voice-engine-input"
        title={ctx.t("settings.engine")}
        value={settings().inputEngine}
        options={engines()}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.inputEngine = value
          })
        }
      />

      <SuggestionRow
        id="voice-input-device"
        title={ctx.t("settings.inputDevice")}
        description={ctx.t("settings.inputDevice.description")}
        placeholder={ctx.t("settings.inputDevice.default")}
        value={settings().transcribe.inputDevice}
        loadLabel={ctx.t("settings.inputDevice.load")}
        emptyLabel={ctx.t("settings.noDevices")}
        eager
        load={async () => [
          { value: "", label: ctx.t("settings.inputDevice.default") },
          ...(await listInputDevices(ctx.t("settings.inputDevice.fallback"))),
        ]}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.transcribe.inputDevice = value
          })
        }
      />

      <Show when={settings().inputEngine === "local"}>
        <TextRow
          id="voice-binary"
          title={ctx.t("settings.binary")}
          description={ctx.t("settings.binary.description")}
          placeholder="C:\\Tools\\whisper.cpp\\whisper-cli.exe"
          value={settings().transcribe.localBinary}
          onChange={(value) =>
            ctx.stores.settings.update((draft) => {
              draft.transcribe.localBinary = value
            })
          }
        />
        <TextRow
          id="voice-model-local"
          title={ctx.t("settings.model")}
          description={ctx.t("settings.model.description")}
          placeholder="C:\\Tools\\whisper.cpp\\models\\ggml-base.bin"
          value={settings().transcribe.localModel}
          onChange={(value) =>
            ctx.stores.settings.update((draft) => {
              draft.transcribe.localModel = value
            })
          }
        />
      </Show>

      <Show when={settings().inputEngine === "cloud"}>
        <ProviderRow
          id="voice-transcribe-provider"
          value={settings().transcribe.provider}
          onChange={(provider, baseURL) =>
            ctx.stores.settings.update((draft) => {
              draft.transcribe.provider = provider
              draft.transcribe.cloudModel = ""
              if (baseURL) draft.transcribe.cloudURL = baseURL
            })
          }
        />

        <Show
          when={
            !settings().transcribe.provider ||
            !providerBaseURL(settings().transcribe.provider)
          }
        >
          <TextRow
            id="voice-transcribe-url"
            title={ctx.t("settings.url")}
            description={ctx.t("settings.url.description")}
            placeholder="https://api.openai.com/v1"
            type="url"
            value={settings().transcribe.cloudURL}
            onChange={(value) =>
              ctx.stores.settings.update((draft) => {
                draft.transcribe.cloudURL = value
              })
            }
          />
        </Show>

        <Show when={!settings().transcribe.provider}>
          <SecretRow
            id="voice-key-transcribe"
            title={ctx.t("settings.apiKey")}
            description={ctx.t("settings.apiKey.description")}
            configured={props.secrets.configured("transcribe")}
            value={props.secrets.value("transcribe")}
            onChange={(value) => props.secrets.setValue("transcribe", value)}
            onSave={() => props.secrets.save("transcribe")}
            onRemove={() => props.secrets.remove("transcribe")}
          />
        </Show>

        <SuggestionRow
          id="voice-transcribe-model"
          title={ctx.t("settings.model")}
          description={ctx.t("settings.model.description")}
          placeholder={ctx.t("settings.selectModel")}
          value={settings().transcribe.cloudModel}
          loadLabel={ctx.t("settings.models.load")}
          resetKey={`${settings().transcribe.provider}|${settings().transcribe.cloudURL}`}
          load={() =>
            ctx.main(Voice)
              .models({
                slot: "transcribe",
                url: settings().transcribe.cloudURL,
                providerID: settings().transcribe.provider || undefined,
              })
              .then((result) =>
                result.models.map((model) => ({
                  value: model.id,
                  label:
                    modelNames(settings().transcribe.provider, model.id) ??
                    model.name ??
                    model.id,
                })),
              )
          }
          onChange={(value) =>
            ctx.stores.settings.update((draft) => {
              draft.transcribe.cloudModel = value
            })
          }
        />
      </Show>

      <TextRow
        id="voice-language"
        title={ctx.t("settings.language")}
        description={ctx.t("settings.language.description")}
        placeholder="auto"
        value={settings().transcribe.language}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.transcribe.language = value
          })
        }
      />

      <SwitchRow
        id="voice-autosend"
        title={ctx.t("settings.autoSend")}
        description={ctx.t("settings.autoSend.description")}
        checked={settings().autoSend}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.autoSend = value
          })
        }
      />

      <SwitchRow
        id="voice-default-input"
        title={ctx.t("settings.defaultInput")}
        description={ctx.t("settings.defaultInput.description")}
        checked={settings().defaultInput}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.defaultInput = value
          })
        }
      />
    </ctx.ui.SettingsSection>
  )
}
