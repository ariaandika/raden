/// <reference types="./types/index.d.ts"/>
import "./register"
import type { Server, TLSServeOptions } from "bun";
import { createEvent, HttpResponse } from "./http/Http";
import { existsSync } from "fs";

const FgRed = "\x1b[31m"
const t = new Bun.Transpiler({ loader: 'ts', target: 'browser' })

// MAIN
export class Raden<Locals extends {[x: string]: any } = {}> {

  static staticAssets = 'static'
  static useMethodVerb = 'use' as const
  static server = undefined as any as Server

  private static staticExist = existsSync('static');

  routes = [] as {
    method: string
    route: string
    handle: CallableFunction | Raden<any>,
  }[]

  decors = {} as any

  constructor( public prefixRoute = '' ) { }

  get<Param extends string>(route: Param, handle: (event: HttpEvent<Locals & { params: Record<ParseParam<Param>,string> }>) => any) {
    this.routes.push({
      method: 'get',
      route: Util.fixUrl(this.prefixRoute + route),
      handle
    })

    return this
  }
  
  post = methodFactory<Locals>('post')
  put = methodFactory<Locals>('put')
  patch = methodFactory<Locals>('patch')
  delete = methodFactory<Locals>('delete')

  use<Prop extends string,SetLocals>(key: Prop, value: SetLocals): Raden<Locals & { [x in Prop]: SetLocals }>;
  use<SetLocals>(handle: ((e: HttpEvent<Locals>) => SetLocals ) | Raden<any>): Raden<Locals & SetLocals>;
  use(handle: any, val?: any) {

    if (typeof handle == 'string' && val) {
      this.decors[handle] = val
      return this as any
    }

    this.routes.push({ method: Raden.useMethodVerb, route: '', handle })
    return this as any
  }

  listen(opt?: Omit<TLSServeOptions & { port?: number },'fetch'>) {
    const server = Bun.serve({
      fetch: async (request) => await this.main(createEvent<Locals>(request)),
      hostname: opt?.hostname,
      port: opt?.port,
      tls: opt?.tls
    });
    Raden.server = server;
    return this;
  }


  // only ran by root App
  async main(event: HttpEvent<Locals>) {

    Object.assign(event.locals, this.decors)

    try {
      if (Raden.staticExist) {
        // TODO: cache static file on production
        const file = Bun.file(Raden.staticAssets + event.req.path);
        if (await file.exists()) {
          return new Response(file)
        } else if (event.req.path.startsWith('/dist')) {
          const file = Bun.file(Raden.staticAssets + event.req.path.replace('/dist','').replace('.js','.ts'))
          if (await file.exists()) {
            return new Response(t.transformSync(await file.arrayBuffer()))
          }
        }
      }
      const resultEvent = await this.runApp(event)
      if (!resultEvent.config.handleFound) {
        return resultEvent.res.notFound()
      }
      console.log('Return:',typeof resultEvent.res.body)
      return resultEvent.res.build()
    } catch (err: any) {
      console.log('Throw:',typeof err)
      if (err instanceof Response) {
        return err
      } else if (err instanceof HttpResponse) {
        return err.build()
      } else if (typeof err == 'string' || typeof err == 'number') {
        event.res.body = err
        return event.res.build()
      } else if (err == undefined || err == null) {
        return event.res.build()
      } else {
        console.log(FgRed + '%s\x1b[0m', "[ERROR]");
        console.error(err)
        console.log(FgRed + '%s\x1b[0m', "[/ERROR]");
        return new Response('500 Internal Server Error',{ status: 500, headers: {"content-type": "text/html"} })
      }
    }
  }

  // will be run if `use(App)` and initial App
  async runApp(event: HttpEvent<Locals>, parentUseHandles = [] as CallableFunction[]): Promise<HttpEvent<Locals>> {
    const useHandles = [] as CallableFunction[]

    for (let i = 0,len = this.routes.length; i < len; i++) {
      const { route, method, handle } = this.routes[i];
      
      if (method === Raden.useMethodVerb) {
        if (typeof handle === 'function') {
          useHandles.push(handle)
          continue

        } else {
          if (handle.prefixRoute !== '' && !event.req.path.startsWith( handle.prefixRoute )) continue

          useHandles.push(...parentUseHandles)

          const resultEvent = await handle.runApp(event as any,useHandles)
          if (resultEvent.config.handleFound) {
            return resultEvent as any
          }
          continue

        }
      }

      let params: any

      if (method.toLowerCase() !== event.req.request.method.toLowerCase()) continue;
      if ( !(params = Util.matchRoute(event.req.path, route )) ) continue;
      if (handle instanceof Raden) continue;

      // @ts-ignore
      event.locals.params = params

      if (event.req.request.method.toLowerCase() == 'post') {
        if (event.req.headers.get('Content-Type')) {
          try {
            const body = event.req.headers.get('Content-Type') == 'application/json' ?
              await event.req.request.json() :
              Object.fromEntries(await event.req.request.formData())

            event.req.body = body
          } catch (error) {
            event.res.status = 400
            throw undefined
          }
        } else {
          event.res.status = 400
          throw undefined
        }
      }

      for (let i = 0, len = parentUseHandles.length; i < len; i++) {
        Object.assign(event.locals, await parentUseHandles[i](event))
      }

      for (let i = 0, len = useHandles.length; i < len; i++) {
        Object.assign(event.locals, await useHandles[i](event))
      }
      
      /** MAIN HANDLER */{
        const result = await handle(event)
        if (result === undefined || result === null) { } else {
          event.res.body = result
        }
      }

      for (let i = 0, len = event.config.transforms.length; i < len; i++) {
        const result = await event.config.transforms[i](event.res.body,event)
        if (result === undefined || result === null) { } else {
          event.res.body = result
        }
      }

      event.config.handleFound = true
      return event
    }

    return event
  }

  inspect() {
    console.log(this.routes.map(e=>e.route))
  }
}


function methodFactory<T extends {[x:string]:any}>(method: string) {
  return function<Param extends string>(this: Raden<T>, route: Param, handle: PostHandle<T,Param>) {
    this.routes.push({ method, route: Util.fixUrl(this.prefixRoute + route), handle })
    return this
  }
}


export class Util {
  static matchRoute(requestUrl: string, targetUrl: string) {
    if (targetUrl == '*' || targetUrl == '/*') return {}

    if (!targetUrl.match(/[:\*]/)) return requestUrl === targetUrl ? {}  : false

    const requrl = requestUrl.split('/').slice(1)
    const match = targetUrl.split('/').slice(1)

    if (requrl.length !== match.length) return false

    const params = {} as any

    for (let i = 0, len = requrl.length; i < len; i++) {
      const req = requrl[i]
      const url = match[i]

      if (url.startsWith(':')) {
        params[url.slice(1)] = req
        continue
      }
      
      if (req !== url) return false
    }

    return params as Record<string,any>
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



type PostHandle<T,Param> = (state: HttpEvent<T & { params: Record<ParseParam<Param>,string> }>) => any;

type ParseParam<T,U = never> = 
  T extends `${string}:${infer R}/${infer S}` ? ParseParam<S,U | R> : 
  T extends `${string}:${infer R}/` ? U | R :
  T extends `${string}:${infer R}` ? U | R :
U;





