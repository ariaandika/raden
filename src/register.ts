global.log = function<T>(val?:T) {
  console.log(val)
  return val
}

global.production = Bun.env.NODE_ENV == "production"

export {}
