import { assertEquals } from 'jsr:@std/assert@1'
import {
  referrerHost,
  releasesToSnapshotRows,
  sumSnapshot,
  buildTimeseries,
  buildSlackDownloadPayload,
} from './lib.ts'

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
  })
  assertEquals(payload.text, 'New PopDict download: PopDict-&lt;arm64&gt;.dmg')
  assertEquals(payload.blocks[1].fields, [
    { type: 'mrkdwn', text: '*Version*\nv1.1.2' },
    { type: 'mrkdwn', text: '*Asset*\nPopDict-&lt;arm64&gt;.dmg' },
    { type: 'mrkdwn', text: '*Referrer*\nnews.ycombinator.com' },
    { type: 'mrkdwn', text: '*Country*\nUS' },
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

Deno.test('sumSnapshot totals across assets', () => {
  const { total, byAsset } = sumSnapshot([
    { asset: 'a.dmg', download_count: 3 },
    { asset: 'b.dmg', download_count: 4 },
  ])
  assertEquals(total, 7)
  assertEquals(byAsset, { 'a.dmg': 3, 'b.dmg': 4 })
})

Deno.test('buildTimeseries carries github forward and accumulates website', () => {
  const series = buildTimeseries(
    [{ date: '2026-06-30', total: 16 }], // no snapshot recorded on 07-01
    [{ date: '2026-06-30', count: 20 }, { date: '2026-07-01', count: 5 }],
  )
  assertEquals(series, [
    { date: '2026-06-30', github: 16, website: 20, combined: 36 },
    { date: '2026-07-01', github: 16, website: 25, combined: 41 },
  ])
})
