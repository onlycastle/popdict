import { assertEquals } from 'jsr:@std/assert@1'
import {
  referrerHost,
  releasesToSnapshotRows,
  sumSnapshot,
  buildTimeseries,
  buildSlackDownloadPayload,
  countByCountry,
  countByDimension,
  DOWNLOAD_EVENT_PAGE_ORDER,
  matchesBearerSecret,
  matchesSecret,
  SNAPSHOT_PAGE_ORDER,
} from './lib.ts'

Deno.test('download secrets fail closed when unset or blank', () => {
  assertEquals(matchesSecret(null, undefined), false)
  assertEquals(matchesSecret('', ''), false)
  assertEquals(matchesSecret('record-token', 'record-token'), true)
  assertEquals(matchesBearerSecret('Bearer undefined', undefined), false)
  assertEquals(matchesBearerSecret('Bearer ', ''), false)
  assertEquals(matchesBearerSecret('Bearer stats-token', 'stats-token'), true)
})

Deno.test('referrerHost strips path and query, tolerates junk', () => {
  assertEquals(referrerHost('https://news.ycombinator.com/item?id=1'), 'news.ycombinator.com')
  assertEquals(referrerHost('https://popdict.space/'), 'popdict.space')
  assertEquals(referrerHost(null), null)
  assertEquals(referrerHost('not a url'), null)
})

Deno.test('buildSlackDownloadPayload formats a safe Slack notice', () => {
  const payload = buildSlackDownloadPayload({
    version: 'v1.1.2',
    asset: 'PopDict-<arm64>.dmg',
    referrer_host: 'news.ycombinator.com',
    country: 'US',
    source: 'github',
    cta: 'readme',
  })
  assertEquals(payload.text, 'New PopDict download redirect: PopDict-&lt;arm64&gt;.dmg')
  assertEquals(payload.blocks[1].fields, [
    { type: 'mrkdwn', text: '*Version*\nv1.1.2' },
    { type: 'mrkdwn', text: '*Asset*\nPopDict-&lt;arm64&gt;.dmg' },
    { type: 'mrkdwn', text: '*Referrer*\nnews.ycombinator.com' },
    { type: 'mrkdwn', text: '*Country*\nUS' },
    { type: 'mrkdwn', text: '*Source*\ngithub' },
    { type: 'mrkdwn', text: '*CTA*\nreadme' },
  ])
})

Deno.test('releasesToSnapshotRows flattens every asset', () => {
  const rows = releasesToSnapshotRows([
    { tag_name: 'v1.1.1', assets: [
      { name: 'PopDict-1.1.1-arm64.dmg', download_count: 3 },
      { name: 'PopDict-darwin-arm64-1.1.1.zip', download_count: 0 },
    ] },
    { tag_name: 'v1.1.0', assets: [{ name: 'PopDict-1.1.0-arm64.dmg', download_count: 6 }] },
  ])
  assertEquals(rows.length, 3)
  assertEquals(rows[0], { tag: 'v1.1.1', asset: 'PopDict-1.1.1-arm64.dmg', download_count: 3 })
})

Deno.test('sumSnapshot keeps DMG installs separate from updater ZIPs', () => {
  const result = sumSnapshot([
    { asset: 'a.dmg', download_count: 3 },
    { asset: 'b.dmg', download_count: 4 },
    { asset: 'updater.zip', download_count: 9 },
    { asset: 'checksums.txt', download_count: 2 },
  ])
  assertEquals(result, {
    dmg: 7,
    zip: 9,
    other: 2,
    byAsset: { 'a.dmg': 3, 'b.dmg': 4, 'updater.zip': 9, 'checksums.txt': 2 },
  })
})

Deno.test('buildTimeseries carries DMG forward and accumulates redirects separately', () => {
  const series = buildTimeseries(
    [{ date: '2026-06-30', dmg: 16 }], // no snapshot recorded on 07-01
    [{ date: '2026-06-30', count: 20 }, { date: '2026-07-01', count: 5 }],
  )
  assertEquals(series, [
    { date: '2026-06-30', dmg: 16, redirects: 20 },
    { date: '2026-07-01', dmg: 16, redirects: 25 },
  ])
})

Deno.test('countByDimension keeps missing attribution visible', () => {
  assertEquals(
    countByDimension([
      { source: 'Website' },
      { source: 'website' },
      { source: 'github' },
      { source: null },
      { source: 'constructor' },
    ], 'source'),
    { website: 2, github: 1, unknown: 1, constructor: 1 },
  )
})

Deno.test('pagination orders include unique tie-breakers at page boundaries', () => {
  assertEquals(DOWNLOAD_EVENT_PAGE_ORDER, ['occurred_at', 'id'])
  assertEquals(SNAPSHOT_PAGE_ORDER, ['captured_on', 'asset', 'tag'])
})

Deno.test('countByCountry uppercases codes and buckets missing as unknown', () => {
  assertEquals(
    countByCountry([
      { country: 'KR' },
      { country: 'kr' },
      { country: 'US' },
      { country: null },
      { country: '  ' },
    ]),
    { KR: 2, US: 1, unknown: 2 },
  )
})
