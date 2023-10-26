import type { HttpRequest, HttpResponse, HttpConfig } from "../http/Http";

declare global {
  interface HttpEvent<Locals extends { [x: string]: any } = any> {
    req: HttpRequest
    res: HttpResponse
    config: HttpConfig<Locals>
    locals: Locals
  }
}

export {}
