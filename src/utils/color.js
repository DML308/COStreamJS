export function debug(...args) {
    console.log("%c " + args[0], "color: #0598bd", ...args.slice(1))
}
export function green(...args) {
    console.log("%c " + args[0], "color: #00bc00", ...args.slice(1))
}
export function line(...args) {
    const line = args[0].first_line || args[0]
    console.log(`%c line:${line} %c ${args[1]} `, "color: #00bc00", "color: #0598bd", ...args.slice(2))
}
export const errors = []
export function error(...args) {
    const error_obj = { msg:'', other:[] }
    args.forEach(arg =>{
        if(typeof arg === "string"){
            error_obj.msg += arg
        }else if(typeof arg === 'object' && arg.first_line !== undefined){
            error_obj.loc = arg
        }else{
            error_obj.other.push(arg)
        }
    })
    errors.push(error_obj)
    console.log("%c " + error_obj.msg, "color: #cd3131", ...error_obj.other)
}

export default { debug, line, error, green }