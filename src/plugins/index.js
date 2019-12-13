import Matrix from './Matrix'
import { COStreamJS } from "../FrontEnd/global"

const Plugins = {
    after(functionName, buf){
        if (COStreamJS.plugins.matrix){
            return Matrix[functionName](buf);
        }
        return buf
    }
}

export default Plugins