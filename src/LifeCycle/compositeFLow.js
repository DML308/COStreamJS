import { binopNode, compositeCallNode} from "../ast/node.js"
import { unfold } from "../FrontEnd/unfoldComposite"


export function streamFlow(/* compositeNode */ main) {
    var body_stmt = main.body.stmt_list

    for (var it of body_stmt) {

        if (it instanceof binopNode) {
            var right = it.right;
            if (right instanceof compositeCallNode) {
                debugger
                let comp = right.actual_composite;
                right.actual_composite = unfold.streamReplace(comp,right.inputs, right.outputs, 1);
            }
        }

        else if (it instanceof compositeCallNode) {
            let comp = right.actual_composite;
            it.actual_composite = unfold.streamReplace(comp,it.inputs, it.outputs, 1);
        }
        
    }
}
