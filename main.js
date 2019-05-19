import * as utils from "./src/utils"
import * as NodeTypes from "./src/ast/node.js"
import { loadCVPPlugin } from "./src/ast/constantValuePropagation"
import { loadToStringPlugin,ast2String } from "./src/ast/toString"
import { S, initSymbol } from "./src/struct/symbol"
loadCVPPlugin()
loadToStringPlugin()

var COStreamJS = {}
COStreamJS.global = typeof window === "object" ? window : global
Object.assign(COStreamJS.global, utils)
Object.assign(COStreamJS.global, NodeTypes,{
    S,
    initSymbol,
    ast2String
})