# RPG Your Way 1.7.4

Runtime hotfix for the migrated Play interface.

- The WPC gameplay shell calls `useMotionPreference()` as soon as Play renders.
- RPG Your Way 1.7.1 copied that consumer but omitted WPC's required `MotionPreferenceProvider`, causing `/play` to fall into Next.js's client error page on every account/device.
- `/play` is now wrapped in `MotionPreferenceProvider` while Start remains responsible for import and campaign selection.
- No SQL, billing, package dependency, campaign format, or AdSense changes.
