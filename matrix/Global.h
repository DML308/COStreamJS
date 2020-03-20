
#ifndef _GLOBAL_H
#define _GLOBAL_H
#include "Buffer.h"
#include <math.h>
#include <string>
using namespace std;
#include "Eigen/Dense"
using Eigen::MatrixXd;
typedef MatrixXd Matrix;

struct streamData{
  Matrix x;
};

extern Buffer<streamData>Source_0_B_1;
extern Buffer<streamData>B_1_Sink_2;

#endif
