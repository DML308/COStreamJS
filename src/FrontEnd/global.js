//对外的包装对象
export var COStreamJS = {
    S : null,
    gMainComposite : null
} 
COStreamJS.__proto__ = {}
//vector<Node *> compositeCall_list; 存储splitjoin/pipeline中的compositeCall调用
export var compositeCall_list = [];
