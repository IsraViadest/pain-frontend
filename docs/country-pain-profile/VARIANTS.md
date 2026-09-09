# Selected web and projection release

Last updated: 2026-09-09. Version: 2.0.

The active application contains one country-profile configuration and one emotional-network
configuration. All previous design rounds and their catalogue are preserved on Git branch
`feat/country-pain-profile-rounds` at `22083b8`. They are historical prototypes, not deployment
candidates. The selected settings were compared before/after consolidation and agree exactly.

| Mode | Local URL | Difference |
|---|---|---|
| Web | http://127.0.0.1:3000/ | Selected artwork, survey action and festival invitation. |
| Projection | http://127.0.0.1:3000/?cpProjection=1 | Hidden survey footprint, no invitation, HQ by default. |
| Web HQ | http://127.0.0.1:3000/?hq=1 | Higher output resolution; independent effect-detail budgets. |
| Projection normal | http://127.0.0.1:3000/?cpProjection=1&hq=0 | Same projection layout at normal resolution. |

Emotion exclusions remain interactive. Historical `cpPreset` and emotional preset overrides
no longer select alternate designs. The old `cp=1` gate is unnecessary but harmless.

The selected emotional source is the September 5 v2 75/25 dataset, not the newer 25.9-million
corpus product. Country profiles now cover all 206 entries in the geography/emotion union.
GDP remains strictly 2024 pending the source-year decision for Greenland's available 2023 value.

See [GOAL.md](GOAL.md) for verification and remaining browser/device acceptance.
