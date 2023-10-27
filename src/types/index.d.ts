import type { HttpRequest, HttpResponse, HttpConfig } from "../http/Http";

declare global {
  interface HttpEvent<Locals extends { [x: string]: any } = any> {
    req: HttpRequest
    res: HttpResponse
    config: HttpConfig<Locals>
    locals: Locals
  }

  var production: boolean
  
  function log<T>(val?: T, ...vals: any[]): T
}

export {}
