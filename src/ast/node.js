import { definePrivate } from "../utils/js-hacker.js"

export class Node {
    constructor(loc) {
        this._loc = loc;
        ['_source', '_loc'].forEach(key => {
            definePrivate(this, key)
        })
    }
}
export class expNode extends Node {
    constructor(loc) {
        super(loc)
    }
}

export class unaryNode extends expNode {
    constructor(first, second, loc) {
        super(loc)
        Object.assign(this, { first, second })
    }
};

export class binopNode extends expNode {
    constructor(left, op, right, loc) {
        super(loc)
        Object.assign(this, { left, op, right })
    }
}

export class ternaryNode extends expNode {
    constructor(first, second, third, loc) {
        super(loc)
        Object.assign(this, { first, second, third })
    }
}

export class parenNode extends expNode {
    constructor(exp, loc) {
        super(loc)
        this.exp = exp
    }
}

export class idNode extends expNode {
    constructor(name, loc) {
        super(loc)
        this.name = name
    }
}

export class constantNode extends expNode {
    constructor(sourceStr, loc) {
        super(loc)
        this.value = Number(sourceStr)
    }
}