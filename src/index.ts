/// <reference types="./types/index.d.ts"/>
import "./register"
import type { Server, TLSServeOptions } from "bun";
import { createEvent } from "./http/Http";

const FgRed = "\x1b[31m"

type ParseParam<T,U = never> = 
  T extends `${string}:${infer R}/${infer S}` ? ParseParam<S,U | R> : 
  T extends `${string}:${infer R}/` ? U | R :
  T extends `${string}:${infer R}` ? U | R :
U;

export interface Raden<T extends Record<string,any> = {}> {
  prefix: string
  middlewares: CallableFunction[]
  plugins: CallableFunction[]
  routes: { handles: CallableFunction[], route: string }[]

  get: typeof get
  post: ReturnType<typeof methodFactory>
  put: ReturnType<typeof methodFactory>
  patch: ReturnType<typeof methodFactory>
  delete: ReturnType<typeof methodFactory>

  use: typeof use
  middleware: typeof middleware
  listen: typeof listen
}

// warning to self, routes as array because dynamic routes

export type RadenMaster = typeof Raden
export const Raden = function(prefix = ''): Raden {
  return {
    routes: [],
    middlewares: [],
    plugins: [],
    prefix,
    use,
    get,
    middleware,
    post: methodFactory('POST'),
    put: methodFactory('PUT'),
    patch: methodFactory('PATCH'),
    delete: methodFactory('DELETE'),
    listen,
  }
}

Raden.useMethodVerb = 'use'
Raden.server = undefined as any as Server
Raden.routes = {}

function use<Locals extends Record<string,any>, SetLocals>(this: Raden<Locals>, handle: ((e: HttpEvent<Locals>) => SetLocals) | Raden<any>): Raden<Locals & SetLocals> {
  if (typeof handle == 'function') {
    this.plugins.push(handle)
    return this as any
  }

  this.middlewares.push(...handle.middlewares)
  this.routes.push(...handle.routes)

  return this as any
}

function middleware<Locals extends Record<string,any>, SetLocals>(this: Raden<Locals>, handle: (e: HttpEvent<Locals>) => SetLocals): Raden<Locals & SetLocals> {
  this.middlewares.push(handle)
  this.plugins.push(handle)
  return this as any
}

function get<
    Locals extends Record<string,any>, 
    Param extends string
  >(
    this: Raden<Locals>, 
    route: Param, 
    ...handles: ((event: HttpEvent<Locals & { params: Record<ParseParam<Param>,string> }>) => any)[]) 
{
  this.routes.push({
    route: 'GET:' + Util.fixUrl(this.prefix + route),
    handles: this.plugins.concat(handles) as any,
  })
  return this
}

function methodFactory(method: string) {
  return function<Locals extends Record<string,any>,Param extends string> (
    this: Raden<Locals>, 
    route: Param, 
    ...handles: ((event: HttpEvent<Locals & { params: Record<ParseParam<Param>,string> }>) => any)[]) {
    this.routes.push({
      route: method + ':' + Util.fixUrl(this.prefix + route),
      handles: this.plugins.concat(handles) as any,
    })
    return this
  }
}

function listen<Locals extends Record<string,any>>(this: Raden<Locals>, opt?:Omit<TLSServeOptions,'fetch'>) {
  const serve = async (req: Request) => await main(this, createEvent(req))
  Raden.server = Bun.serve({...opt, fetch: serve})
  return this;
}


  // only ran by root App
async function main<Locals extends Record<string,any>>(raden: Raden<Locals>, event: HttpEvent<Locals>) {
  try {
    await runApp(raden, event)
    if (!event.config.handleFound) {
      return event.res.notFound()
    }

    return event.res.build()

  } catch (err: any) {
    console.log(FgRed + '%s\x1b[0m', "[ERROR]");
    console.error(err)
    console.log(FgRed + '%s\x1b[0m', "[/ERROR]");
    return new Response('500 Internal Server Error',{ status: 500, headers: {"content-type": "text/html"} })
  }
}

// will be run if `use(App)` and initial App
async function runApp<Locals extends Record<string,any>>(raden: Raden<Locals>, event: HttpEvent<Locals>) {

  const params = {} as any

  const route = raden.routes.find(e => Util.matchRoute(event, e.route, params))

  if (!route) {
    // @ts-ignore
    event.locals.__notfound = true
    for (let i = 0, len = raden.middlewares.length; i < len; i++) {
      const elem = await raden.middlewares[i](event)

      if (event.config.handleFound) {
        event.res.body = elem

      } else {
        Object.assign(event.locals, elem)
      }

      if (event.config.handleFound) { break }
    }
    return
  }

  // @ts-ignore
  event.locals.params = params

  await parseRequestBody(event)

  for (let i = 0, len = route.handles.length; i < len; i++) {
    const elem = await route.handles[i](event)

    if (i == len - 1 || event.config.handleFound) {
      if (elem === null || elem === undefined) { } else {
        event.res.body = elem
      }

    } else {
      Object.assign(event.locals, elem)
    }

    if (event.config.handleFound) { break }
  }

  for (let i = 0, len = event.config.transforms.length; i < len; i++) {
    const result = await event.config.transforms[i](event.res.body,event)
    if (result === undefined || result === null) { } else {
      event.res.body = result
    }
  }

  event.config.handleFound = true
}


async function parseRequestBody(event: HttpEvent) {
  if (event.req.request.method == 'GET') return

  if (!event.req.headers.get('Content-Type')) {
    event.res.status = 400
    throw undefined
  }

  event.req.body = event.req.headers.get('Content-Type') == 'application/json' ? 
    await event.req.request.json() : 
    Object.fromEntries((await event.req.request.formData()).entries());
}





export class Util {
  static matchRoute(event: HttpEvent, targetUrl: string, outParams?: Record<string,any>) {
    const requestUrl = event.req.path
    const requestMethod = event.req.request.method

    if (targetUrl.startsWith(requestMethod)) {
      targetUrl = targetUrl.slice(requestMethod.length + 1)
    } else {
      return false
    }

    if (targetUrl == requestUrl) {

    } else {
      return false
    }

    if (targetUrl == '*') return true

    const requrl = requestUrl.split('/').slice(1)
    const match = targetUrl.split('/').slice(1)

    // TODO: add support for wildcard routes
    if (requrl.length !== match.length) return false

    for (let i = 0, len = requrl.length; i < len; i++) {
      const req = requrl[i]
      const url = match[i]

      if (url.startsWith(':')) {
        if (outParams)
          outParams[url.slice(1)] = req
        continue
      }

      if (req !== url) return false
    }

    return true
  };

  /**
  * no double '/' side by side
  * must begin '/'
  * remove trailing '/'
  */
  static fixUrl(url: string) {
    while (true) {
      let ok = true

      if (url === '/') return url

      if (url.endsWith('/')) {
        ok = false
        url = url.slice(0,-1)
      }

      url.replaceAll('//','/')

      if (ok) return url
    }
  }
}
