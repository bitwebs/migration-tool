const os = require('os')
const p = require('path')
const fs = require('fs').promises

const level = require('level')
const sub = require('subleveldown')
const bjson = require('buffer-json-encoding')
const collectStream = require('stream-collector')
const { Client: BitspaceClient, Server: BitspaceServer } = require('bitspace')

const BITSPACE_ROOT = p.join(os.homedir(), '.bitspace')
const BITSPACE_STORAGE_DIR = p.join(BITSPACE_ROOT, 'storage')
const BITSPACE_CONFIG_DIR = p.join(BITSPACE_ROOT, 'config')

const FUSE_CONFIG_PATH = p.join(BITSPACE_CONFIG_DIR, 'fuse.json')

const DAEMON_ROOT = p.join(os.homedir(), '.bitdrive')
const DAEMON_STORAGE_DIR = p.join(DAEMON_ROOT, 'storage')
const DAEMON_DB_PATH = p.join(DAEMON_STORAGE_DIR, 'db')
const DAEMON_CHAINS_PATH = p.join(DAEMON_STORAGE_DIR, 'chains')

const MIGRATION_DIR = p.join(DAEMON_STORAGE_DIR, '.migration')

async function migrate (opts = {}) {
  if (await isMigrated()) return

  const rootDb = level(DAEMON_DB_PATH)
  const fuseDb = sub(rootDb, 'fuse', { valueEncoding: bjson })
  const drivesDb = sub(rootDb, 'drives')
  const networkDb = sub(drivesDb, 'seeding', { valueEncoding: 'json' })
  await networkDb.open()
  await fuseDb.open()

  // Move the old storage directory into the migration directory.
  if (!opts.noMove && !(await exists(MIGRATION_DIR))) {
    await migrateChains()
  }

  // Start the Bitspace server on the migration directory.
  const server = new BitspaceServer({
    storage: opts.noMove ? DAEMON_CHAINS_PATH : MIGRATION_DIR,
    noAnnounce: true
  })
  await server.open()
  const client = new BitspaceClient()
  await client.ready()

  // Migrate the network configurations in the old database into the Bitspace storage trie.
  await migrateNetworkConfigs(client, networkDb)

  // Migrate the root FUSE drives into a bitdrive-cli config file.
  await migrateRootDrive(fuseDb)

  // Shut down the Bitspace server.
  await server.close()

  // Atomically rename the migration directory to .bitspace.
  if (!opts.noMove) {
    await fs.mkdir(BITSPACE_ROOT, { recursive: true })
    await fs.rename(MIGRATION_DIR, BITSPACE_STORAGE_DIR)
  }
}

async function isMigrated (opts = {}) {
  // If the bitdrive-daemon was never installed, abort.
  if (!(await exists(DAEMON_STORAGE_DIR))) return true
  // If the bitspace storage directory has already been created, abort.
  if (await exists(BITSPACE_STORAGE_DIR)) return true
  // If the bitspace config directory has been created, and noMove is true, abort.
  if (opts.noMove && (await exists(BITSPACE_CONFIG_DIR))) return true
  return false
}

async function migrateNetworkConfigs (client, db) {
  const allNetworkConfigs = await dbCollect(db)
  for (const { key: discoveryKey, value: networkOpts } of allNetworkConfigs) {
    if (!networkOpts || !networkOpts.opts) continue
    const opts = networkOpts.opts
    await client.network.configure(Buffer.from(discoveryKey, 'hex'), {
      announce: !!opts.announce,
      lookup: !!opts.lookup,
      remember: true
    })
  }
}

async function migrateRootDrive (db) {
  const rootDriveMetadata = await dbGet(db, 'root-drive')
  if (!rootDriveMetadata) return null
  var key = rootDriveMetadata.opts && rootDriveMetadata.opts.key
  if (Buffer.isBuffer(key)) key = key.toString('hex')
  await fs.mkdir(BITSPACE_CONFIG_DIR, { recursive: true })
  return fs.writeFile(FUSE_CONFIG_PATH, JSON.stringify({
    rootDriveKey: key,
    mnt: p.join(os.homedir(), 'Bitdrive')
  }, null, 2))
}

async function migrateChains () {
  return fs.rename(DAEMON_CHAINS_PATH, MIGRATION_DIR)
}

async function exists (path) {
  try {
    await fs.access(path)
    return true
  } catch (err) {
    return false
  }
}

function dbCollect (index, opts) {
  return new Promise((resolve, reject) => {
    collectStream(index.createReadStream(opts), (err, list) => {
      if (err) return reject(err)
      return resolve(list)
    })
  })
}

async function dbGet (db, idx) {
  try {
    return await db.get(idx)
  } catch (err) {
    if (err && !err.notFound) throw err
    return null
  }
}

module.exports = {
  migrate,
  isMigrated
}
