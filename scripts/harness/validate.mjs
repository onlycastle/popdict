#!/usr/bin/env node
// Deterministic gate runner: `npm run harness:validate`.
// Exits non-zero on any violation. Gates only read the tracked tree — no
// network, no agent judgement, no flakiness.
import { execFileSync } from 'node:child_process'
import { makeContext } from './lib.mjs'
import * as secretScan from './secretScan.mjs'
import * as docLinks from './docLinks.mjs'
import * as wikiAudit from './wikiAudit.mjs'
import * as electronInvariants from './electronInvariants.mjs'
import * as supabaseBoundary from './supabaseBoundary.mjs'
import * as coverageRatchet from './coverageRatchet.mjs'
import * as driftCheck from './driftCheck.mjs'

const GATES = [
  secretScan,
  docLinks,
  wikiAudit,
  electronInvariants,
  supabaseBoundary,
  coverageRatchet,
  driftCheck,
]

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const ctx = makeContext(root, { gateIds: GATES.map((g) => g.gate) })

let total = 0
for (const g of GATES) {
  const { gate, violations } = g.run(ctx)
  const status = violations.length === 0 ? 'ok' : `FAIL (${violations.length})`
  console.log(`${gate.padEnd(20)} ${status}`)
  for (const v of violations) {
    console.log(`  ${v.file}${v.line ? ':' + v.line : ''}  ${v.message}`)
  }
  total += violations.length
}

console.log(total === 0 ? '\nall gates green' : `\n${total} violation(s)`)
process.exit(total === 0 ? 0 : 1)
