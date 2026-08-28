# RPG Your Way 1.11.1

Realtime diagnostics and streaming-WAV readback hotfix.

- Fixes TTS readback measurement for the streaming WAV format returned by OpenAI, whose RIFF and data chunk sizes may use `0xFFFFFFFF` placeholders until end-of-stream.
- Measures the actual received PCM payload instead of rejecting those streaming WAV responses as having no measurable audio data.
- Moves the Ably TokenRequest exchange to the RPG Your Way server so malformed keys, rejected credentials, and permission failures surface before the browser attempts its realtime connection.
- Trims the server-side `ABLY_API_KEY` value before use.
- Preflights the multiplayer realtime credential before creating the browser Ably client, preserving the useful server error instead of allowing it to collapse into the generic `Connection to server unavailable` message.
- Includes Ably error code and HTTP status in the Table Chat error when the credential succeeds but the realtime transport itself still fails.
- Keeps the 1.11.0 Phase 1 product boundary unchanged: human Table Chat, Presence, lobby, seats, and reconnect only; shared AIGM synchronization and multi-payer billing remain later phases.
