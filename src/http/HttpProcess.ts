import { Cookie } from "./lib/Cookie";

export class HttpRequest {
  url: URL
  path: Readonly<string>
  headers: Headers
  cookie: Cookie
  body: any

  constructor(public request: Request) {
    this.url = new URL(request.url)
    this.cookie = new Cookie(request.headers.get("cookie"))
    this.headers = request.headers
    this.path = this.url.pathname

    while (this.path.endsWith('/') && this.path != '/') {
      this.path = this.path.slice(-1)
    }

    this.url.pathname = this.path
  }

}

export class HttpResponse {
  status = 200
  headers = new Headers()
  cookie = new Cookie()
  body: any

  constructor(public request: Request){}

  notFound() {
    return new Response(undefined,{
      status: 404
    })
  }

  redirect(location: string) {
    const pr = Boolean(this.request.headers.get('pr-request'))
    this.status = pr ? 200 : 302;
    this.headers.set(`${pr ? 'pr-':''}location`,location)
  }

  use(...cb: ((this: typeof this, req: typeof this) => void)[]) {
    for (let i = 0, len = cb.length; i < len; i++) {
      cb[i].call(this,this)
    }
  }

  build() {
    this.cookie.serialize(this.headers)

    // fixing headers
    if (this.body && !this.headers.get('content-type') && !(this.body instanceof Blob)) {
      this.headers.set('content-type',typeof this.body == 'object' ? 'application/json' : 'text/html');
    }

    // fixing body
    if (this.body instanceof Blob) { }
    else if (this.body === null || this.body === undefined) { }

    else if (this.body instanceof Response) {
      return this.body
    } else if (typeof this.body == 'object') {
      this.body = JSON.stringify(this.body)
    } else {
      this.body = String(this.body)
    }

    return new Response(this.body,{
      status: this.status,
      headers: this.headers
    })
  }
}




