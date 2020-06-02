
#ifndef _Source_
#define _Source_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class Source{
  public:
  Source(Buffer<streamData>& S,int steadyC,int initC):S(S){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    S.resetTail();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    S.resetTail();
  }
  private:
  Producer<streamData>S;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
  }
  
  void pushToken(){
    S.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
  }
  void work(){
    
    cout<<"矩阵构造结果:全零矩阵\n"<<Matrix::Zero(2,2)<<endl;
    cout<<"矩阵构造结果:全一矩阵\n"<<Matrix::Ones(2,2)<<endl;
    cout<<"矩阵构造结果:随机矩阵\n"<<Matrix::Random(2,2)<<endl;
    cout<<"矩阵构造结果:单位矩阵\n"<<Matrix::Identity(2,2)<<endl;
    double m0[] = {
      0,1,1,0
    };
    cout<<"矩阵构造结果:矩阵常量\n"<<Eigen::Map<Eigen::Matrix<double,2,2>>(m0)<<endl;
    S[0].x=matrixs[1];
    S[0].x(1,0)=0;
    Matrix A=S[0].x;
    cout<<"获取数据流上的矩阵A\n"<<S[0].x<<endl;
    cout<<"A的行数: "<<S[0].x.rows()<<endl;
    cout<<"A的列数: "<<S[0].x.cols()<<endl;
    Eigen::FullPivLU<Matrix> luA(S[0].x);
    cout<<"A的秩: "<<luA.rank()<<endl;
    cout<<"A的迹: "<<S[0].x.trace()<<endl;
    cout<<"A的行列式值: "<<S[0].x.determinant()<<endl;
    cout<<"\n矩阵运算部分:"<<endl;
    cout<<"A的逆矩阵:\n"<<A.inverse()<<endl;
    cout<<"A+1的结果:\n"<<A.array()+1<<endl;
    cout<<"A与其逆矩阵点乘的结果\n"<<A.matrix()*A.inverse().matrix()<<endl;
    cout<<"\n矩阵映射部分:"<<endl;
    cout<<"A.exp():\n"<<A.array().exp()<<endl;
    cout<<"A.sin():\n"<<A.array().sin()<<endl;
    cout<<"(A+1).pow():\n"<<(A.array()+1).array().pow(2)<<endl;
    
    pushToken();
    popToken();
  }
  
};
#endif
