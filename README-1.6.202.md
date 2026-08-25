# RPG Your Way 1.6.202

Small post-launch hotfix and onboarding-front-door pass.

- Customer Script debits now settle to whole cents while exact provider cost remains recorded internally.
- Account history therefore reconciles visibly: a displayed -$0.75 changes the displayed balance by exactly $0.75.
- Adds a truthful Script progress bar driven only by completed continuity/writing steps; the activity dot indicates an in-flight request without pretending to estimate time remaining.
- Adds `/start` as the permanent onboarding front door and a **New Player** link on the landing campaign card.
- Updates landing copy to say Script is available now.
- Finishes the Vercel Web Analytics integration by rendering `<Analytics />`; the dependency was already installed separately.
- No AdSense code is included yet.

Version note: the lockfile/deployment repair after 1.6.200 is treated as hotfix 1.6.201, so this release is 1.6.202.
