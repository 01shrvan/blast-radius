# Blast Radius

Famous internet outages, rebuilt as small machines you can run.

Each outage is replayed from the company's own postmortem. You watch the bad change spread, see what it did to the fleet, then change one decision (stage the rollout, keep the guard, pull the kill switch earlier) and run it again.

Every line on a page is either a verbatim quote from the postmortem, linked to it, or marked as modelled. The assumptions behind each replay are listed on its page.

## How it works

- `incidents/*.json` holds one outage each: timeline, facts, levers and assumptions, every one with a quote and a source.
- `engine/sim.mjs` replays an incident second by second. `engine/schema.mjs` validates a spec and checks that every quote really appears in its source.
- `engine/sim.test.mjs` runs each incident as it happened and checks the result against the numbers in the postmortem.
- The figures are drawn with the [Anatomy](https://github.com/wheresryan22/anatomy) isometric kit, vendored under `vendor/` (MIT).

## Run it

Node 20 or later, no dependencies.

```sh
pnpm test
pnpm build
```

## Outages so far

| Company | Date | What broke |
|---|---|---|
| Cloudflare | 2 July 2019 | A WAF rule with a runaway regex went everywhere at once |
