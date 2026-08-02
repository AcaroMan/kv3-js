# kv3-js

Parse and stringify Valve's [KeyValues3](https://developer.valvesoftware.com/wiki/KeyValues3) (KV3) format.  
Used in CS2, Dota 2, and other Source 2 games for `.vmap`, `.vpcf`, `.vsnd`, and many other file types.

## Install

```sh
npm install kv3-js
```

## Usage

### `parseKV3(text)` — KV3 → JavaScript

```js
const { parseKV3 } = require('kv3-js');

const kv3 = `
<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{
  name = "my_map"
  version = 1
  enabled = true
  tags = [ "cs2", "vmap" ]
  spawn = { x = 128 y = 256 z = 0 }
  model = resource:"models/props/barrel.vmdl"
}
`;

const { value, header } = parseKV3(kv3);

console.log(value.name);           // "my_map"
console.log(value.tags);           // ["cs2", "vmap"]
console.log(value.spawn.x);        // 128
console.log(value.model);          // { __kv3_resource: "models/props/barrel.vmdl" }
console.log(header?.format);       // "generic"
```

### `stringifyKV3(value, options?)` — JavaScript → KV3

```js
const { stringifyKV3, KV3Header } = require('kv3-js');

const obj = {
  name: 'my_map',
  version: 1,
  enabled: true,
  tags: ['cs2', 'vmap'],
  spawn: { x: 128, y: 256, z: 0 },
};

const kv3 = stringifyKV3(obj, {
  headerMode: 'custom',
  header: new KV3Header(),
});

console.log(kv3);
```

#### Options

| Option | Default | Description |
|--------|---------|-------------|
| `headerMode` | `default` | Controls whether to include the default header, omit it, or use a custom header. |
| `header` | `undefined` | Custom header string or header instance used when `headerMode` is `custom`. |
| `indent` | `2` | Spaces per indent level. |

### Header helpers

```js
const { KV3Header } = require('kv3-js');

const header = new KV3Header({ format: 'generic' });
console.log(header.toString());
console.log(header.toJSON());
```

### File helpers

```js
const { parseKV3File, stringifyKV3File } = require('kv3-js');

const { value } = parseKV3File('./example.kv3');
stringifyKV3File('./out.kv3', value, { headerMode: 'omit' });
```

### CLI

```sh
npx kv3-js parse ./example.kv3
npx kv3-js stringify ./example.kv3 --out ./out.kv3
```

## Flags

KV3 flags survive a parse → stringify round-trip and are exposed as tagged objects:

```js
// Parsed from:  model = resource:"models/hero.vmdl"
// Becomes:
{ __kv3_resource: 'models/hero.vmdl' }

// Stringified back to:
// model = resource:"models/hero.vmdl"
```

## License

MIT
