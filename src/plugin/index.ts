

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



