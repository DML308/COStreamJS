export let symbol_tables = [];

export class SymbolTable {
    constructor(p, loc) {
        this.compTable = new Map();
        this.idTable = new Map();
        this.optTable = new Map();
        this.prev = p;
        this.loc = loc;
        if (p) {
            p.children = p.children || [];
            p.children.push(this);
        }
        symbol_tables.push(this);
        /*program.filter(node=> node instanceof compositeNode).forEach(node=>{
            this.compTable.set(node.compName,node)
        })*/
    }
    LookUpCompositeSymbol(name) {
        return this.compTable.get(name)
    }
    InsertCompositeSymbol(node) {
        if (this.compTable.get(node.compName)) {
            console.log('composite: ' + node.compName + 'is already defined in this scope')
            return;
        }
        this.compTable.set(node.compName, node);
    }
    LookUpIdSymbol(name) {
        let idNode = this.idTable.get(name);
        if (idNode) {
            return idNode;
        }
        let prev = this.prev
        while (prev) {
            idNode = prev.idTable.get(name);
            if (idNode) {
                return idNode
            }
            prev = prev.prev;
        }
        return undefined;
    }
    InsertIdSymbol(node, name) {
        if (this.idTable.get(node.name)) {
            console.log(node.name + 'is already defined in this scope')
            return;
        }
        name = name ? name : node.name;
        this.idTable.set(name, node);
    }

    printSymbol() {
        let result = {};
        let print_name = ['compTable', 'idTable'];
        print_name.forEach(key => {
            result[key] || (result[key] = []);
            for (let [mapkey, value] of this[key]) {
                result[key].push(mapkey);
            }
        })
        return result;
    }

    printAllSymbol() {
        let all_tables_name = [];
        all_tables_name.push(this.printSymbol());
        if (this.children) {
            this.children.forEach(child => {
                all_tables_name = all_tables_name.concat(child.printAllSymbol());
            })
        }
        return all_tables_name;
    }
}

// 查找第一个大于 target 的 值
function getFirstBigger(target,symbol_tables) {
    var left = 0,
        right = symbol_tables.length - 1,
        middle = 0;
    while (left <= right) {
        middle = Math.floor((left + right) / 2);
        if (symbol_tables[middle].loc.last_line > target)
            right = middle - 1;
        else if (symbol_tables[middle].loc.last_line < target)
            left = middle + 1;
        else
            return middle;
    }
    return left;
}

// 查找最后 一个小于 target 的 值
function getLastSmaller(target,symbol_tables) {
    var left = 0,
    right = symbol_tables.length - 1,
        middle = 0;
    while (left <= right) {
        middle = Math.floor((left + right) / 2);
        if (symbol_tables[middle].loc.first_line > target)
            right = middle - 1;
        else if (symbol_tables[middle].loc.first_line < target)
            left = middle + 1;
        else
            return middle;
    }
   return right;
}


var isSorted = false;

export function initIsSort(){
    isSorted = false;
}
var first_symbol_tables,last_symbol_tables;

SymbolTable.FindRightSymbolTable = function (target) {
    if(!isSorted){
        last_symbol_tables = symbol_tables.slice();
        first_symbol_tables = symbol_tables.slice();
        first_symbol_tables.sort((a,b)=>a.loc.first_line - b.loc.first_line);
        last_symbol_tables.sort((a,b)=>a.loc.last_line - b.loc.last_line);
        isSorted = true;
    }
    var line_start, line_end;
    line_end = getFirstBigger(target,last_symbol_tables);
    line_start = getLastSmaller(target,first_symbol_tables);

    var last_loc = last_symbol_tables[line_end].loc;
    var first_loc = first_symbol_tables[line_start].loc;
    if(last_loc.first_line<= target && last_loc.last_line >= target){
        return last_symbol_tables[line_end];
    }else {
        return first_symbol_tables[line_start];
    }



    


}