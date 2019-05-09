(function () {
    'use strict';

    function debug(...args){
        console.log("%c "+args[0],"color: #0598bd",...args.slice(1));
    }
    function green(...args){
        console.log("%c " + args[0], "color: #00bc00", ...args.slice(1));
    }
    function line(...args) {
        const line = args[0].first_line || args[0];
        console.log(`%c line:${line} %c ${args[1]} `,"color: #00bc00", "color: #0598bd" ,...args.slice(2));
    }
    function error(...args) {
        console.log("%c " + args[0], "color: #cd3131", ...args.slice(1));
    }

    var color = { debug,line,error,green };

    Object.assign(window,color);

}());
