# Router Reference

## Define Route

handler can be:

- object, immediately send
- function, will be run on request

```ts
const app = new Raden('/counter') // optional prefix

.get('/', e => e)     // static path
.get('/:id', e => e)  // parameter path, via `event.locals.params`
```

## Define Plugin

plugin are lazily run, means if no route match, it will not run (will change).

anything that returned here, will be available in the next handlers via `event.locals`

plugins can be

- object, for extended behavior
- function, will be run on request
- `Raden` instance

```ts

const app = new Raden()

.use((e) => {
  return { getDate() { return Date.now() } }
})

.use((e) => {
  e.config.handleFound = true // early return, next handler wont be called
  return <div>Unauthorized</div>
})

const main = new Raden()
.use(app)   // any plugin in `app` will not assigned for the next route

```

## Static Assets

static folder is `static` by default

anything inside static, can be accessed at root level

```
- static
| - favicon.svg
| - app.js

# url

/favicon.svg
/app.js
```

## Other Behavior

pathname trailing slash will be striped

if handler return string, content-type will always be text/html

