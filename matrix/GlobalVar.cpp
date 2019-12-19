#include "GlobalVar.h"
MatrixXd matrixs[8];
void initGlobalVar(){
  matrixs[0] = MatrixXd(2,2);
  matrixs[0] << 0,0,0,0;
  
  matrixs[1] = MatrixXd(2,2);
  matrixs[1] << 1,1,1,1;
  
  matrixs[2] = MatrixXd(2,2);
  matrixs[2] << 2,2,2,2;
  
  matrixs[3] = MatrixXd(2,2);
  matrixs[3] << 3,3,3,3;
  
  matrixs[4] = MatrixXd(2,2);
  matrixs[4] << 4,4,4,4;
  
  matrixs[5] = MatrixXd(2,2);
  matrixs[5] << 5,5,5,5;
  
  matrixs[6] = MatrixXd(2,2);
  matrixs[6] << 6,6,6,6;
  
  matrixs[7] = MatrixXd(2,2);
  matrixs[7] << 7,7,7,7;
}

