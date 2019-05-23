import { binopNode, compositeCallNode} from "../ast/node.js"
import { unfold } from "../FrontEnd/unfoldComposite"
import { COStreamJS } from "../FrontEnd/global"

export function streamFlow(/* compositeNode */ main) {
    var body_stmt = main.body.stmt_list

    for (var it of body_stmt) {

        if (it instanceof binopNode) {
            var right = it.right;
            if (right instanceof compositeCallNode) {
                let comp = COStreamJS.S.LookUpCompositeSymbol(right.compName)
                right.actual_composite = unfold.streamReplace(comp,right.inputs, right.outputs, 1);
            }
        }

        else if (it instanceof compositeCallNode) {
            let comp = COStreamJS.S.LookUpCompositeSymbol(it.compName)
            it.actual_composite = unfold.streamReplace(comp,it.inputs, it.outputs, 1);
        }
        
    }
}
