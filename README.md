# opencode-voice

Plugin de voz bidireccional para **OpenCode Desktop**:

- **Dictado**: graba el micrófono, transcribe con whisper.cpp local o con un proveedor compatible con OpenAI (Whisper) y deja el texto en el prompt.
- **Lectura**: al terminar cada bloque de texto del agente, lo lee en voz alta con la voz del sistema (SAPI en Windows) o con un TTS en la nube.
- **Conversación (experimental)**: escucha sola, cierra el turno al detectar silencio, envía el mensaje y lee la respuesta, y vuelve a escuchar. Al activar el modo, la píldora del compositor cambia al icono de conversación; **al pulsarla empieza el ciclo** y, mientras dura, sigue con ese icono. Si hablas mientras se lee la respuesta, la lectura se corta y tu turno se envía en cuanto callas. Con una respuesta sonando, el extremo de la píldora muestra el stop y solo calla la voz; la ✕ (o Escape, o volver a pulsar la píldora) detiene el ciclo y deja el modo listo para volver a empezar.
- **Por chat**: cada sesión tiene su propio interruptor de entrada y salida, persistente. Los chats nuevos heredan el valor por defecto de los ajustes.
- **Ajustes propios** en **Settings > Voice**, sin tocar `opencode.json` salvo para cargar el plugin.

## Requisitos

- OpenCode Desktop (la API GUI es experimental y puede cambiar entre versiones).
- Node 20+ y npm para compilar.
- **Entrada local**: [`whisper.cpp`](https://github.com/ggml-org/whisper.cpp) compilado (`whisper-cli.exe`, `main.exe`, …) y un modelo `ggml-*.bin`. El plugin graba WAV 16 kHz mono, así que **no hace falta ffmpeg**.
- **Salida local**: en Windows usa SAPI (voces instaladas del sistema); en macOS `say`; en Linux `espeak-ng`. Se sintetiza a WAV y lo reproduce la propia ventana.
- **Nube**: cualquier proveedor compatible con OpenAI en `/audio/transcriptions` y `/audio/speech`.

## Compilar y activar

```powershell
cd C:\Develop\Proyectos\opencode-voice
npm install
npm run build
```

Añade el plugin al `opencode.jsonc` **global** (`%USERPROFILE%\.config\opencode\opencode.jsonc`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["C:/path/to/opencode-voice"]
}
```

Reinicia la app o abre una ventana nueva. La parte GUI se carga desde el servidor propio de Desktop.

## Uso

- Atajo **Ctrl/Cmd + Shift + Space** (o `/dictate`): inicia el dictado; vuelve a pulsarlo para parar y transcribir.
- **Enter con el prompt vacío** hace lo mismo. Si hay texto, Enter envía como siempre.
- Icono de micrófono junto al compositor: **solo aparece cuando el dictado tiene un proveedor configurado y el interruptor de dictado del chat está activado**. Un clic graba o para. Mientras graba, la misma cápsula muestra la **onda en vivo** (64 barras simétricas) y una **✕** al final que cancela el dictado; al transcribir quedan el icono y la ✕ dentro de la cápsula.
- **Escape** cancela el dictado mientras graba o transcribe; si no hay dictado activo, sigue interrumpiendo la sesión como siempre.
- Mientras se lee una respuesta, esa misma cápsula muestra un **stop** para cortar la cola y el audio en curso (si el micrófono no está disponible, el stop aparece como píldora aparte).
- En la fila del título del chat: el engranaje está **siempre** visible y abre un popover con dos **switches alineados a la derecha** (dictado y lectura) y el acceso a **Settings > Voice**. A su lado, un **micrófono** y un **bocadillo con puntos** (con su estado en color de acento) solo aparecen si su dirección está configurada (el micrófono sigue el mismo criterio que el icono del compositor).
- El interruptor de dictado del chat es la **puerta única**: con él apagado no aparece el micrófono, Enter y el atajo no dictan, y si se apaga mientras graba o transcribe, se cancela. La lectura funciona igual: con el interruptor apagado no se leen respuestas.
- Comandos: `/voice on|off`, `/voice input|output`, `/voice settings`, `/dictate`, `/speak` y `/shush`. `/voice` sin argumentos muestra el estado.
- El atajo se puede cambiar en **Settings > Shortcuts**.

Con `autoSend` desactivado, el texto se inserta en el compositor para revisarlo. Activado, se envía en cuanto termina la transcripción.

## Configuración

**Settings > Voice**:

- **Pestañas**: `Entrada`, `Salida` y `Experimental`, para que la página no sea un scroll largo.
- Motor de entrada y de salida: `Local` o `Nube`.
- **Micrófono**: se puede elegir el dispositivo de entrada (o dejar el predeterminado del sistema). La lista se carga desde el propio equipo.
- **Dispositivo de salida**: dónde se reproducen las respuestas; también se puede dejar el predeterminado del sistema.
- **Proveedor de OpenCode**: reutiliza la conexión del proveedor y **su URL y su credencial** automáticamente; con un proveedor seleccionado no hay que escribir ni URL ni clave. Con `Manual` se usan la URL y la clave del plugin.
- **Modelos**: primero se configura la URL y la clave (o se elige un proveedor), después se cargan los modelos. Al **cambiar de proveedor el modelo se deselecciona** y hay que elegir uno de la lista nueva. El selector abre un buscador en un diálogo compacto, muestra toda la lista (los modelos de audio primero) y filtra al escribir; el valor guardado es el id y la etiqueta es el nombre amigable cuando existe. Si la carga devuelve modelos, no se permite escribir a mano: solo se elige de la lista. El campo de texto queda solo como respaldo cuando no se encuentra ninguno.
- **Voces locales**: mismo flujo; se listan las voces del sistema y se elige una.
- **Salida local**: hay que activar explícitamente `Usar la voz del sistema`; hasta entonces la lectura queda deshabilitada, igual que el dictado sin configurar.
- Claves de API manuales: se guardan **cifradas** con `safeStorage` (DPAPI en Windows). Nunca van a `opencode.json`; si el llavero no está disponible, se guardan como texto plano y se avisa en el log.
- Valor por defecto de los interruptores por chat y botón **Probar** para la salida.
- **Experimental**: activa el modo conversación para chats nuevos, el silencio que cierra el turno (1200 ms por defecto) y la pausa al perder el foco.

La nube asume el contrato de OpenAI. Si tu proveedor usa otro formato (por ejemplo Deepgram), cambia `transcribeCloud` en `src/gui/main/transcribe-cloud.ts` y `speakCloud` en `src/gui/main/speech-cloud.ts`: el resto del plugin no cambia.

El icono del compositor y los controles del encabezado se calculan a partir de la configuración: binario y modelo en local, URL, modelo y clave en la nube.

## Desarrollo

```powershell
npm run watch   # recompila dist/gui-experimental.cjs al guardar
npm run typecheck
```

Cada recompilación recarga la GUI en todas las ventanas; si añades o cambias **métodos Ipc**, cierra y vuelve a abrir OpenCode Desktop para que el proceso principal registre el contrato nuevo. El log `voice: main ready { version }` indica qué versión cargó main.

## Estructura

```
src/
  index.ts                  parte servidor mínima (id del plugin)
  gui.tsx                   entrada ./gui-experimental (setup + main)
  gui/
    definition.ts           stores (ajustes globales + flags por sesión)
    i18n/{en,es}.ts         textos de la interfaz
    contract.ts             Ipc ventana ↔ main
    context.ts              tipo del contexto de ventana
    flags.ts                interruptores por sesión
    status.ts               validez de la configuración por dirección
    text.ts                 limpieza de Markdown y troceado
    audio/wav.ts            codificación WAV, remuestreo y base64 (puro)
    audio/meter.ts          medición RMS, suavizado y máscara de la onda (puro)
    audio/devices.ts        enumeración de micrófonos
    recorder.ts             micrófono sobre los helpers de audio
    window.tsx              composición fina de la ventana
    window/                 dictado, entrega, voz, eventos, comandos, píldora, encabezado y ajustes
    settings.tsx            composición de la página de ajustes
    settings/rows.tsx       filas reutilizables de ajustes
    settings/provider-row.tsx    selector de proveedor de OpenCode
    settings/suggestion-row.tsx  campo con lista de modelos o voces
    main.ts                 composición fina del proceso principal
    main/                   claves, credenciales, procesos, transcripción, voz, modelos, voces y temporales
  rpc.ts                    contrato RPC para resolver credenciales de OpenCode
```

Las convenciones de código están en [`AGENTS.md`](./AGENTS.md): código en inglés, módulos pequeños con una sola responsabilidad, funciones fábrica en lugar de clases y helpers puros separados del host.

## Notas

- El audio se captura en la ventana (permiso de micrófono del renderer) y se envía a `main` como WAV en base64. `main` sintetiza la voz y devuelve el audio; **la ventana lo reproduce** con un `<audio>`, porque `setSinkId` es la única forma de elegir el dispositivo de salida y Chromium decodifica WAV y MP3 sin programas externos. Las claves siguen viviendo en un único sitio.
- La lectura se dispara con `session.text.ended` por cada bloque de texto, y se ignoran las sesiones hijas (subagentes).
- Los bloques se encolan por ventana: una respuesta larga no se pisa a sí misma, y empezar a dictar corta la cola y la reproducción en curso.
- El texto se limpia de Markdown y de las URLs antes de hablarlo, pero **conserva el contenido del código en línea** (nombres de fichero, funciones, flags), porque suele ser lo que importa de la frase; los bloques de código, con acentos o indentados, sí se omiten. Se trocea en frases de ~600 caracteres.
- Se hablan las tablas (con o sin barras en los extremos) como frases de celdas, y desaparecen reglas, casillas, imágenes, notas al pie, emojis de dos puntos, autolinks, fórmulas y los corchetes que quedan sueltos. Las entidades HTML se decodifican y los identificadores con guion bajo se respetan.
- El dictado no se detiene solo al hacer una pausa: hay que volver a pulsar el atajo o el micrófono. Si la captura es silenciosa, el aviso lo distingue de “no se ha detectado voz”.
- Las credenciales de OpenCode se resuelven en la parte servidor y se entregan al proceso principal por el servidor local; no se escriben en la configuración ni en los logs.
- En modo conversación el micrófono queda abierto mientras esperas y mientras se lee la respuesta. Hablar por encima de la lectura la corta y empieza un turno nuevo; con altavoces el micro puede oírse a sí mismo, así que para interrumpir hablando conviene usar auriculares.
- El dictado manual y la conversación comparten un solo grabador; en conversación solo se guarda un pre-roll de 1,2 s hasta que hay voz, así que una espera de minutos no acumula audio.
- El formato de salida de la nube ya no depende del reproductor del sistema: `mp3`, `wav`, `opus`, `aac` y `flac` se decodifican en la ventana. Si el proveedor responde con JSON o texto, el error muestra el cuerpo de la respuesta.
- Desactivar el plugin entero: **Settings > Extensions > Plugins**, o quita la entrada de `opencode.jsonc`.
- Logs: `~/.local/share/opencode/log/opencode.log`.
