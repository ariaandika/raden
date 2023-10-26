import { HttpResponse, HttpRequest } from "./HttpProcess";
export { HttpResponse, HttpRequest }

export function createEvent<Locals extends {[x: string]:any}>(request: Request) {
  const req = new HttpRequest(request)
  const res = new HttpResponse(request)
  const locals = {} as any
  const config = new HttpConfig<Locals>()

  return { req, res, locals, config } satisfies HttpEvent<Locals>
}

export class HttpConfig<Locals extends {[x:string]:any}> {
  public defers = [] as ((event: HttpEvent<Locals>) => (any|Promise<any>))[]
  public transforms = [] as ((body: any, event: HttpEvent<Locals>) => any | Promise<any>)[]

  public handleFound = false;

  public transform(cb: (body: any,event: HttpEvent<Locals>) => (any | Promise<any>)) {
    this.transforms.push(cb)
  }

  public defer(cb: ((event: HttpEvent<Locals>) => (any|Promise<any>))) {
    this.defers.push(cb)
  }
};

