# `bitspace-migration-tool`
A tool for migrating from the [BitDrive daemon](https://github.com/bitwebs/bitdrive-daemon) to [BitSpace](https://github.com/bitwebs/bitspace).

This tool does a few things:
1. It moves all your stored unichains from `~/.bitdrive/storage/chains` to `~/.bitspace/storage`.
2. It copies all network configurations (the chains you're seeding) from the daemon's Level instance (at `~/.bitdrive/storage/db`) into Bitspace's config trie.
3. It copies your FUSE root drive key into a separate config file that will be loaded by [`bitdrive-cli`](https://github.com/bitwebs/bitdrive-cli).

### Installation
```
npm i bitspace-migration-tool -g
```

### Usage
This migration tool is currently bundled with Bitspace -- it's run by default when Bitspace is first started, so you shouldn't have to run this manually. After a few months or so, we'll be removing it. 

If you'd like to do the migration manually anyway, you can install this module globally (`npm i bitspace-migration-tool -g`) and use the included `bin.js` CLI tool.

#### As a module
The tool exports two functions, `migrate` and `isMigrated`. `await migrate()` will perform the migration.

### From the CLI
`./bin.js` will perform the migration. It assumes that your Hyperdrive daemon storage is stored in `~/.bitdrive` and that your Bitspace storage directory is going to be `~/.bitspace`.

### License
MIT
