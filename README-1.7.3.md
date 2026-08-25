# RPG Your Way 1.7.3

Validator-only hotfix for the Start/Play separation pass.

- Removes the stale 1.6.202 assertion that expected the old placeholder Start-page sentence.
- Validates the new Start page by checking for `RpgywStartEntry` instead.
- No runtime, billing, SQL, dependency, or UI behavior changes.
