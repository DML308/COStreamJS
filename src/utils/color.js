function debug(...args){
    console.log("%c "+args[0],"color: #0598bd",...args.slice(1))
}
function line(...args) {
    console.log("%c " + args[0], "color: #00bc00", ...args.slice(1))
}
function error(...args) {
    console.log("%c " + args[0], "color: #cd3131", ...args.slice(1))
}

export default { debug,line,error }