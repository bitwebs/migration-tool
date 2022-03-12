#!/usr/bin/env node
const { migrate } = require('.')

;(async () => {
  console.log('Migrating from the BitDrive daemon to BitSpace...')
  try {
    await migrate()
    console.log('Migration succeeded!')
  } catch (err) {
    console.error('Migration failed:', err)
  }
})()

