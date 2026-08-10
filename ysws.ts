import t from 'typebox';
const schema = t.Array(t.Object({
  name: t.String(),
  enabled: t.Boolean(),
  shortName: t.String(),
  authRequired: t.Boolean(),
  url: t.String(),
}))

export default [{
  name: "Stardance",
  enabled: true,
  shortName: "sd",
  authRequired: false,
  url: "https://stardance.hackclub.com"
}] as t.Static<typeof schema>