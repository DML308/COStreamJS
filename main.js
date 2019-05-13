import * as utils from "./src/utils"
import * as NodeTypes from "./src/ast/node.js"
import { loadCVPPlugin } from "./src/ast/constantValuePropagation"

loadCVPPlugin()

var COStreamJS = {}
COStreamJS.global = typeof window === "object" ? window : global
Object.assign(COStreamJS.global, utils)
Object.assign(COStreamJS.global, NodeTypes)