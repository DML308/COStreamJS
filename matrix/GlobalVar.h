#ifndef GLOBALVAL_H
#define GLOBALVAL_H
#include "Eigen/Dense"
using Eigen::MatrixXd;
typedef MatrixXd Matrix;
void initGlobalVar();

extern Matrix matrixs[8];
#endif
