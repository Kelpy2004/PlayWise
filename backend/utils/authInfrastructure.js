const { query } = require('../lib/postgres')

async function ensureAuthInfrastructure() {
  await query(`
    create table if not exists "EmailVerificationToken" (
      id text primary key,
      "userId" text not null references "User"(id) on delete cascade,
      email text not null,
      "tokenHash" text not null unique,
      "expiresAt" timestamptz not null,
      "usedAt" timestamptz null,
      "createdAt" timestamptz not null default now()
    )
  `)

  await query(`create index if not exists "EmailVerificationToken_userId_idx" on "EmailVerificationToken" ("userId")`)
  await query(`create index if not exists "EmailVerificationToken_email_idx" on "EmailVerificationToken" (email)`)
  await query(
    `create index if not exists "EmailVerificationToken_expiresAt_idx" on "EmailVerificationToken" ("expiresAt")`
  )
}

module.exports = {
  ensureAuthInfrastructure
}
