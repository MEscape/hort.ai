# Alexa connection test (Development stage only)

`POST /api/alexa` answers Alexa with a fixed PlainText sentence in the standard Alexa voice:
LaunchRequest (and Help/other intents) → `ahoi aura ai wäre auch gut gewesen`, Stop/Cancel → `Tschüss`,
SessionEndedRequest → empty response. No persistence, account linking, child data or learning logic.

Every request is checked with the official ASK SDK verifiers (`SkillRequestSignatureVerifier`,
`TimestampVerifier` from `ask-sdk-express-adapter`) and against `ALEXA_SKILL_ID`.

## Environment

| Name             | Required | Notes                                                               |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `ALEXA_SKILL_ID` | yes      | `amzn1.ask.skill.…` from the console. Unset → endpoint answers 503. |

## Skill package

- Interaction model (de-DE, invocation name `hort`): `alexa/skill-package/interactionModels/custom/de-DE.json`
- Manifest: `alexa/skill-package/skill.json` (endpoint URI is the current development tunnel; replace with the deployed host).

## Developer Console (Custom skill, Provision your own)

1. Create Skill → name `hort.ai`, primary locale **German (DE)**, experience Other, model **Custom**,
   hosting **Provision your own**, template **Start from Scratch**.
2. Interaction Model → JSON Editor → paste `de-DE.json` → Save → Build skill.
3. Endpoint → **HTTPS** → default region URL `https://<host>/api/alexa`; SSL certificate type:
   trusted CA, or "sub-domain of a domain that has a wildcard certificate" for hosts such as
   `*.trycloudflare.com` / `*.vercel.app` → Save.
4. Copy the Skill ID shown on the Endpoint page into `ALEXA_SKILL_ID` and redeploy/restart. Until then
   every real Alexa request is rejected (503 unset / 403 wrong skill), so the simulator only works after this step.
5. Test → "Skill testing is enabled in: Development" → simulator `öffne hort`.
6. Echo: registered to the same Amazon account as the developer console, device language German.
   Say: **„Alexa, öffne hort“**. Do not submit for certification or publish.
