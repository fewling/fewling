<img src="./assets/header.svg" alt="fewling — mobile, backend, cloud, ai" width="100%" />

Floating Lyric reads whatever's playing through Android's notification stream and
paints time-synced lyrics in a system overlay over any app. Behind it I own the
whole stack — a contract-first API (OpenAPI → generated clients), a rate-limited
Genkit/DeepSeek translation service with output validation, and a JWT auth backend
I'm migrating off Firebase onto a self-hosted Spring Boot microservices monorepo.
I also ship fixes upstream into Flutter itself.

---

## Floating Lyric

Time-synced lyrics in a floating overlay that stays on top of any Android app.
**[On Google Play →](https://play.google.com/store/apps/details?id=com.floating.lyrics)**

**The hard parts**

- Reads the currently-playing track from any music app through a
  `NotificationListenerService` over Android MediaSessions — no per-app integration.
- Paints a system overlay over arbitrary foreground apps from a foreground service,
  bridged to Flutter across custom Method/Event platform channels.
- Time-syncs `.lrc` on device (Hive), with Storage Access Framework import and
  online lyric search as fallback.
- Translation runs server-side through a Genkit flow on DeepSeek — with an output
  validator, App Check, and per-user rate limiting.

**System design**

One contract, three languages. An OpenAPI 3.1 spec is the single source of truth:
the Dart client and the TypeScript functions are both generated from it, and the
Kotlin services share the same DTOs — so a polyglot system can't drift. The backend
is mid-migration from Firebase Cloud Functions to a self-owned **Spring Boot
microservices monorepo** (Kotlin, Java 25) — its own JWT + refresh-rotation auth
service, shared contract libraries, and custom Gradle convention plugins — for cost,
control, and owning the runtime end to end.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'ui-monospace, SFMono-Regular, Menlo, monospace','primaryColor':'#161b22','mainBkg':'#161b22','primaryTextColor':'#e6edf3','nodeTextColor':'#e6edf3','primaryBorderColor':'#1D9E75','nodeBorder':'#1D9E75','lineColor':'#5DCAA5','textColor':'#adbac7','clusterBkg':'#0d1117','clusterBorder':'#30363d','edgeLabelBackground':'#0d1117'}}}%%
flowchart TB
  subgraph DEV["on device · android (kotlin)"]
    direction LR
    NL["notification listener<br/>reads any app's MediaSession"]
    OV["overlay foreground service<br/>draws over any app"]
    PC["method + event channels"]
  end
  subgraph APP["flutter app"]
    direction LR
    BLOC["BLoC · go_router"]
    HIVE["Hive store<br/>lyrics · settings"]
    OBS["Firebase<br/>Crashlytics · Analytics · App Check"]
    CLI["generated API client"]
  end
  subgraph CON["contract · single source of truth"]
    SPEC["OpenAPI 3.1<br/>translate · feature flags · version gate"]
  end
  subgraph FB["backend · firebase (current)"]
    direction LR
    FN["Cloud Functions<br/>auth + rate-limit middleware"]
    GK["Genkit flow<br/>translate + validator"]
    FS["Firestore<br/>rate limits · supporters"]
    WH["Ko-fi / Afdian webhooks"]
  end
  subgraph SB["backend · spring boot (in progress)"]
    direction LR
    CORE["core service"]
    AUTH["auth service<br/>JWT + refresh rotation"]
    LIBS["shared contract libs"]
  end
  DS["DeepSeek LLM"]

  NL --> PC
  OV --- PC
  PC --> BLOC
  BLOC --> HIVE
  BLOC --> OBS
  BLOC --> CLI
  SPEC -->|codegen| CLI
  SPEC -->|codegen| FN
  SPEC -.shared DTOs.-> LIBS
  CLI -->|HTTPS| FN
  CLI -.migrating.-> CORE
  FN --> GK
  FN --> FS
  WH --> FS
  GK --> DS
  CORE --- LIBS
  AUTH --- LIBS
```

| Repo                                                                                                                    | Role                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [flutter-floating-lyric-openapi](https://github.com/fewling/flutter-floating-lyric-openapi)                             | OpenAPI contract — single source of truth  |
| [flutter-floating-lyric-pkg-generated-openapi](https://github.com/fewling/flutter-floating-lyric-pkg-generated-openapi) | Generated Dart client package              |
| [floating-lyric-spring-boot](https://github.com/fewling/floating-lyric-spring-boot)                                     | Spring Boot (Kotlin) microservices backend |
| [floating-lyric-web](https://github.com/fewling/floating-lyric-web)                                                     | Next.js marketing site                     |

---

## How I work

- **Spec-driven** — every project starts as a written spec + plan in the repo, before any code.
- **Contract-first** — one schema generates the clients and types, so a polyglot system can't drift.
- **Tested & observable** — unit/integration tests across backends and web; crash reporting and analytics from day one.
- **I build my own tooling** — custom Gradle convention plugins, Mason bricks, and agent skills.

The stack, by layer:

<table>
  <tr>
    <td align="right"><b>languages</b></td>
    <td><img src="https://skillicons.dev/icons?i=dart,ts,js,java,kotlin,py,godot,cs&theme=dark" height="44" alt="Dart, TypeScript, JavaScript, Java, Kotlin, Python, GDScript (Godot), C#" /></td>
  </tr>
  <tr>
    <td align="right"><b>frontend</b></td>
    <td><img src="https://skillicons.dev/icons?i=flutter,react,nextjs,tailwind&theme=dark" height="44" alt="Flutter, React, Next.js, Tailwind" /></td>
  </tr>
  <tr>
    <td align="right"><b>backend</b></td>
    <td><img src="https://skillicons.dev/icons?i=spring,nestjs,nodejs,firebase&theme=dark" height="44" alt="Spring Boot, NestJS, Node.js, Firebase" /> <img src="./assets/icons/openapi.svg" height="40" alt="OpenAPI" /></td>
  </tr>
  <tr>
    <td align="right"><b>cloud</b></td>
    <td><img src="https://skillicons.dev/icons?i=aws,gcp,firebase&theme=dark" height="44" alt="AWS, GCP, Firebase" /> <img src="./assets/icons/digitalocean.svg" height="40" alt="DigitalOcean" /></td>
  </tr>
  <tr>
    <td align="right"><b>devops</b></td>
    <td><img src="https://skillicons.dev/icons?i=githubactions,docker&theme=dark" height="44" alt="GitHub Actions, Docker" /> <img src="./assets/icons/ccswitch.png" height="40" alt="cc-switch" /></td>
  </tr>
  <tr>
    <td align="right"><b>ai</b></td>
    <td><img src="https://skillicons.dev/icons?i=vercel&theme=dark" height="44" alt="Vercel AI SDK" /> <img src="./assets/icons/adk.png" height="40" alt="Google ADK" /> <img src="./assets/icons/genkit.png" height="40" alt="genkit" /> <img src="./assets/icons/n8n.svg" height="40" alt="n8n" /> <img src="./assets/icons/dify.svg" height="40" alt="dify" /></td>
  </tr>
</table>

---

## Open source

**[flutter/flutter #168005](https://github.com/flutter/flutter/pull/168005)** —
added header & footer slots to the Material `NavigationDrawer` widget. Merged into
the framework, May 2025.

---

![contribution snake](./dist/snake/snake.svg)

**[felixwong875@gmail.com](mailto:felixwong875@gmail.com)** ·
**[Floating Lyric on Google Play](https://play.google.com/store/apps/details?id=com.floating.lyrics)**
