const fs = require('fs')
const resolve = require('path').resolve

const nodeDir = `./src/ast/node.js`
const relativeDir = `../ast/node.js`
const parserDir = `./src/config/parser.js`


var str = fs.readFileSync(resolve(__dirname, parserDir),"utf8")
var nodeTypes = fs.readFileSync(resolve(__dirname, nodeDir),"utf8")
nodeTypes = nodeTypes.match(/(?<=export class )(\S+)/g).join(',')

str = `import { ${nodeTypes} } from "${relativeDir}" \n${str}\n export default parser`

fs.writeFileSync(resolve(__dirname, parserDir),str)