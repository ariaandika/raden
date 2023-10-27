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

export function serveFile(urlpath: string, file: string) {
  return async (event: HttpEvent) => {
    console.log('oof', event.req.url.pathname, urlpath)
    if (event.req.url.pathname === urlpath) {
      event.res.headers.set('content-type', Bun.file(file).type)
      throw await t.transform(await Bun.file(file).arrayBuffer())
    }
  }
}
