import Matrix from './Matrix'
import { COStreamJS } from "../FrontEnd/global"

const Plugins = {
    after(functionName, ...args){
        if (COStreamJS.plugins.matrix){
            return Matrix[functionName](...args);
        }
        return args[0]
    }
}

export default Plugins