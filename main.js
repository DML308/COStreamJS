import color from "./src/utils/color"
import * as NodeTypes from "./src/ast/node.js"
import { loadCVPPlugin } from "./src/ast/constantValuePropagation"

loadCVPPlugin()

var COStreamJS = {}
COStreamJS.global = typeof window === "object" ? window : global

Object.assign(COStreamJS.global, color)
Object.assign(COStreamJS.global, NodeTypes)