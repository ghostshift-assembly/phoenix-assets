Public Refpath snapshots at `dd5c55e1f6a436fc845756e955d6302f78bba50d`:

- `validator.ex`: `lib/refpath/presentation/validator.ex`
- `presentation.ex`: `lib/refpath/presentation.ex`
- `envelope.json`: `test/fixtures/presentation/report-envelope-v1.json`
- `cases.json`: `test/fixtures/presentation/report-envelope-cases-v1.json`

The upstream Apache-2.0 license is retained in `LICENSE`. `profile.json` is
source-derived by `node scripts/reporting-profile.mjs`; it is not evidence of
an executed producer qualification. Update the public revision and snapshots
together, regenerate the profile, and rerun decoder and extracted-artifact checks.

`qualified/cases.json` and `qualified/proof.json` are offline replay inputs
produced by `scripts/qualify-producer.exs` through the public validator, binder
and encoder. Release qualification binds these inputs to the extracted renderer
and package bytes; the source-derived profile alone does not establish that join.

The renderer's bounded layout profile uses `columns`, `order` and `spans`.
The public producer also accepts opaque JSON layouts outside this profile;
those layouts remain unsupported here. Qualification of the recorded cases
must not be presented as acceptance of every producer-valid opaque layout.
