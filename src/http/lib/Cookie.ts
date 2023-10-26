type CookieOpt = Partial<{
  expires: string,
  maxage: number,
  domain: string,
  path: string,
  secure: boolean,
  http: boolean,
}>

export class Cookie {
  private value = {} as Record<string,string>
  private valueOpt = {} as Record<string,CookieOpt | undefined>

  constructor( cookieStr?: string | null) {
    if (!cookieStr) return

    const cookieObj = cookieStr.split('; ');

    for (let i = 0, len = cookieObj.length; i < len; i++) {
      const [key,val] = cookieObj[i].split('=')
      this.value[decodeURIComponent(key)] = decodeURIComponent(val)
    }
  }

  serialize(headers: Headers) {
    const entries = Object.entries(this.value)
    for (let i = 0, len = entries.length; i < len; i++) {
      const [key,val] = entries[i]
      const opt = this.valueOpt[key]
      let Opt
      if (opt) {
        opt.http ??= true
        opt.secure ??= production
        const { expires, http, path, domain, maxage, secure } = opt
        Opt = 
          (expires  ? `; Expires=${expires}`:'') +
          (http     ? `; HttpOnly`:'') +
          (maxage   ? `; Max-Age=${maxage}`:'') +
          (domain   ? `; Domain=${domain}`:'') +
          (path     ? `; Path=${path}`:'') +
          (secure   ? `; Secure`:'')
      }
      headers.append('Set-Cookie',`${encodeURIComponent(key)}=${encodeURIComponent(val)}${Opt ?? ''}`)
    }
  }

  get(key: string): string | undefined {
    return this.value[key]
  }

  set(key: string, val: string | number | object, opt?: CookieOpt) {
    this.value[key] = typeof val == 'object' ? JSON.stringify(val) : String(val);
    this.valueOpt[key] = opt;
    return this;
  }

  delete(key: string, val = "delete") {
    this.value[key] = val
    this.valueOpt[key] = { expires: new Date(0).toUTCString() };
    return this
  }
}

