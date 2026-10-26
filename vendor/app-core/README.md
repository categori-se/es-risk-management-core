# Categori App Core

This shared module is licensed under Apache-2.0; see LICENSE and NOTICE. Its application-specific adapters, credentials and hosted operation retain their own boundaries. GitHub source release does not publish an npm or Python registry package.

`@categori/app-core` starts with a shared semantic theme foundation consumed by Workspace Management and ESIA. It is an ecosystem component, with no AI Studio, application runtime, SDK, login or authorization dependency. Workspace Management maintains its current source; consumers adopt explicit versions through the ecosystem catalog.

Import `@categori/app-core/theme.css` before the app's own theme and component styles. Apps supply `--app-theme-<role>-light` and optional `--app-theme-<role>-dark` palette inputs. The package resolves those to `--app-<role>` semantic roles for background, surfaces, text, borders, accent, on-accent, status colors, brand and shadows. Font families and radii use mode-independent `--app-theme-font-sans`, `--app-theme-font-mono`, `--app-theme-radius-small` and `--app-theme-radius-medium` inputs. Defaults provide system fonts, 6/8px radii and an accent-derived focus-ring recipe; they do not prescribe an ecosystem palette.

System color preference controls the root by default. Set `data-app-theme="light"`, `"dark"` or `"auto"` on a root or nested element to select a scoped mode. The nested element resolves its own inherited/overridden palette; its siblings retain theirs. Missing dark inputs fall back to the app's light values. Light-only products should supply `--app-theme-color-scheme-light: light`; dual-mode products also supply `--app-theme-color-scheme-dark: dark`. Foreground contrast and a complete usable palette remain the app/profile's responsibility.

Application compatibility aliases should be declared on `:root, [data-app-theme]` so existing component styles recalculate when a nested profile changes. Client presentation customization changes permitted palette/font/radius inputs in an app-owned profile. Arbitrary untrusted CSS is not a configuration interface. Branding, logos, login markup, workflows, authentication configuration and resource authorization stay in the application.

Current source is approved for an Apache-2.0 GitHub prerelease under `categori-se`. Registry publication and application deployment are separate work. The package is not a universal application shell: composition/control primitives can be added as real consumers establish compatible needs.

Application browser checks compare original compiled login screens in light/dark preferences and desktop/mobile viewports, then verify scoped customization through actual component styles. The apps compile this stylesheet with their own palettes and feature styles at build time; browser delivery does not require an npm resolver or runtime theme script.
