# Mobile Upgrades Plan

## Goal
Modernize the Android companion app's build toolchain and dependencies while
keeping every change small enough to review and revert independently.

## Targets

| Component | Current | Target |
|---|---|---|
| Kotlin | 2.0.21 | 2.1.21 |
| KSP | 2.0.21-1.0.25 | 2.1.21-1.0.25 |
| AGP | 8.5.2 | 8.13.2 |
| Gradle wrapper | 8.9 | 8.12.3 |
| Compose BOM | 2024.09.03 | 2025.01.01 |
| Lifecycle | 2.8.6 | 2.8.7 |
| Activity Compose | 1.9.2 | 1.9.3 |
| Room | 2.6.1 | 2.8.4 |
| CameraX | 1.3.4 | 1.4.1 |
| compileSdk | 34 | 35 |
| targetSdk | 34 | 35 |

## Notes
- ML Kit 17.3.0 and OkHttp 4.12.0 are already at their latest stable releases.
- Room 2.8.4 changes the default `fallbackToDestructiveMigration` behavior; the
  app already declares `exportSchema = false` so we do not need a migration path.
- CameraX 1.4.1 keeps `ExperimentalGetImage` opt-in semantics for `ImageAnalysis`.

