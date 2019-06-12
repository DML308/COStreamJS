import { binopNode, compositeCallNode} from "../ast/node.js"
import { unfold } from "../FrontEnd/unfoldComposite"
import { COStreamJS } from "../FrontEnd/global"
import { deepCloneWithoutCircle } from "../utils/index.js";

export function streamFlow(/* compositeNode */ main) {
    var body_stmt = main.body.stmt_list

    for (var stmt of body_stmt) {
        let it = stmt instanceof binopNode ? stmt.right : stmt //获取到要处理的 operator(){}
      
        if (it instanceof compositeCallNode) {
            let comp = COStreamJS.S.LookUpCompositeSymbol(it.compName)
            comp = deepCloneWithoutCircle(comp)
            it.actual_composite = unfold.streamReplace(comp,it.inputs,it.outputs, 1);
        }

    }
}
