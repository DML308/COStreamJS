/**
 * SDF 图划分算法的基类, 子类需要继承此类并实现对应方法
 */
export class Partition {
        constructor(){
            //map<FlatNode *, int> FlatNode2PartitionNum;     
            this.FlatNode2PartitionNum = new Map() //节点到划分编号的映射
            //map < int, vector<FlatNode *> > PartitonNum2FlatNode; //划分编号到节点的映射
            this.PartitonNum2FlatNode = new Map()
            //划分的份数,即核数
            this.mnparts  =   1   
            this.finalParts = 0 //最终所需的核数, 因为划分算法的极端情况下可能用不完全部的核   
        }
    /**
     * 划分成员方法，具体实现由子类实现
     */
    SssgPartition(ssg,  level){
        throw new Error("不能调用基类的 SssgPartition 算法, 请在子类中实现该算法")
    } 
    /**
     * 根据flatnode找到其下标号 如source_0中的0
     */
    findID(/* FlatNode */ flat){
        return flat.name.match(/\d+$/g)[0]
    }  
    /**
     * 根据编号num查找其中的节点，将节点集合返回给PartitonNumSet(编号->节点)
     */        
    findNodeSetInPartition(num){
        return this.PartitonNum2FlatNode.get(num)
    }
    /**
     * 根据节点返回其所在划分区的编号(节点->编号) for dot
     */
    findPartitionNumForFlatNode(/* FlatNode */ flat){
        return this.FlatNode2PartitionNum.get(flat)
    }           
};