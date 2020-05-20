import { version } from '../../package.json'
import { SymbolTable } from './symbol'
//对外的包装对象
export var COStreamJS = {
    S : null,
    gMainComposite : null,
    files: {},
    options: { platform: 'default' },
    plugins: { matrix: false, image: false },
    version
} 
COStreamJS.__proto__ = {}
//vector<Node *> compositeCall_list; 存储splitjoin/pipeline中的compositeCall调用
export var compositeCall_list = [];

/** @type {SymbolTable} */
export let top;
export function setTop(newTop){ top = newTop; }