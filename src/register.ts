// @ts-ignore
global.log = function<T>(val?:T, ...vals: any[]) {
  console.log(val,...vals)
  return val
}

global.production = Bun.env.NODE_ENV == "production"

export {}
