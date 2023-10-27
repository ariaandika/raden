import { Html, HTMLConfig, ModuleConfig } from "@deuzo/enhance-server"

export interface IHTMLConfig {
  module(src: string, opt?: ModuleConfig): void
}

declare global {
  interface EnhanceLayoutArgument {
    event: HttpEvent<{ html: IHTMLConfig & HTMLConfig }>
  }
}

export function html(layout?: HTMLConfig['layout']) {
  return (event: HttpEvent) => {
    event.config.transform((body: any, ev: HttpEvent<{ html: HTMLConfig}>) => {
      if (typeof body == 'string') {
        return Html.postProcess(body, ev.res.headers, ev.locals.html)
      }
    })

    return { html: {
      modules: [
        ['/dist/enhance.js',{}]
      ],
      module(src, opt = {}) {
        this.modules.push([src,opt])
      },
      layout,
      heads: [],
      prHeader: event.req.headers.get('pr-request') ?? undefined,
      layoutArgument: { event }
    } satisfies HTMLConfig & IHTMLConfig } 
  }
}


const t = new Bun.Transpiler({ loader: 'ts' })

export function serveStatic(dir = 'static') {
  return async (event: HttpEvent) => {
    if (!event.locals.__notfound) return

    let file = Bun.file(dir + event.req.path)

    while (true) {
      if (await file.exists()) {
        let res
        
        if (file.name?.endsWith('.ts')) {
          res = await t.transform(await file.arrayBuffer())
          event.res.headers.set('content-type', 'application/javascript')
        }

        event.config.handleFound = true
        return res ?? file
      }

      if (file.name?.endsWith('.js')) {
        file = Bun.file(dir + event.req.path.replace(/\.js$/,'.ts'))
        continue
      }

      break
    }
  }
}

