export const START_FAQ = [
  ['Do I need to know D&D or Pathfinder before I start?', 'No. You can learn while you play. The Game Master can explain rules when they matter, suggest possible actions, and offer choices when that helps.'],
  ['What are the game rules choices?', 'They tell RPG Your Way which rules framework to use. Every new campaign begins in The Uncharted Realms; there is no separate setting choice.'],
  ['What are ready-to-play characters?', 'They are complete D&D 5.5e characters that can begin immediately. The default party is Fighter, Wizard, Cleric, and Rogue, and you can replace any of them.'],
  ['How do I add my own character?', 'Add a PDF, JSON, XML, TXT, or Markdown record by browsing for the file, or paste the character information. Then choose Import into RPG Your Way on that character.'],
  ['What does Import into RPG Your Way do?', 'RPG Your Way uses AI to read the supplied record, convert it into the consistent character structure used during play, and identify anything that genuinely needs clarification. Your original file is not changed.'],
  ['Why is RPG Your Way asking questions about my character?', 'Required questions are blockers that must be resolved before the character can be used correctly. Recommended questions are not blockers, but answering them during setup can prevent guesses or interruptions later during play.'],
  ['Does character import cost anything?', 'Importing a normal character is generally free. If a character record is unusually large or complex, RPG Your Way will tell you before additional AI processing uses part of your available usage balance.'],
  ['Can I change a character name or portrait later?', 'Yes. Names and portraits can be changed later on the Play page through the Characters sidebar.'],
  ['Do I have to use four characters?', 'No. The four-character party is only the default. You can play with fewer characters or build a party of up to six.'],
  ['What is the party leader?', 'RPG Your Way recommends one character as the party leader using the party’s abilities. Leadership is optional, and you can change the recommendation or choose no active leader.'],
  ['Do I have to customize the gameplay settings?', 'No. Choose Use default settings and RPG Your Way will use sensible defaults. Customize them when you want more control over tone, pacing, danger, story emphasis, and boundaries.'],
  ['When does paid gameplay usage begin?', 'Normal Play and Script AI processing use your account balance. Start-page help is free within its 25-question limit. Ordinary character import is included; unusually demanding character records may require paid processing after you are told first.'],
] as const

export const START_HELP_KNOWLEDGE = `RPG Your Way Start-page help is limited to starting a campaign and understanding the choices on the Start page.

The onboarding flow is: choose game rules; gather a party and import custom characters one at a time if needed; customize or use default gameplay settings; accept, change, or decline the proposed party leader; name the campaign and Game Master; continue to Play.

Every new campaign uses The Uncharted Realms. D&D 5.5e (2024 rules / SRD 5.2.1) is the default rules choice. The ready-to-play library currently uses D&D 5.5e.

The default ready-to-play party is Fighter, Wizard, Cleric, and Rogue. Parties may contain one to six characters and may mix ready-to-play and imported characters.

Custom records may be PDF, JSON, XML, TXT, Markdown, or pasted text. Each file may be up to 8 MB. Adding a file merely places it on the Start page. Import into RPG Your Way is the AI step that reads the record and converts it into RPG Your Way's character structure.

Character import uses two automatic defaults: New campaign means the character begins fully rested with full HP/resources, zero temporary HP, clear death saves, and no active conditions unless the record explicitly says otherwise. Don't sweat the small stuff means ordinary inexpensive class necessities may be assumed; priced or consumed components and consequential equipment still matter.

Character clarification has two tiers. Required questions are blockers: RPG Your Way cannot use the character correctly until they are answered. Recommended questions are not blockers, but resolving them during setup may prevent later guesses or interruptions.

Names and portraits can be changed later on the Play page through the Characters sidebar. Portraits are not imported on Start.

RPG Your Way proposes a party leader automatically using its leadership rule. The player may change the proposal or choose no active leader. The full rule is available from How did we choose this leader?.

Gameplay settings are optional. Use default settings skips the questions. Customize asks six short questions about Game Master initiative, campaign emphasis, character-story priorities, combat danger, exclusions, and campaign growth including opening pace, long-term direction, and weirdness/scale.

Start Page Help is free and limited to 25 questions per onboarding session. Do not discuss unrelated topics. If the answer is not in this knowledge, say so briefly instead of guessing.`
