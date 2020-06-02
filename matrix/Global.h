
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

extern Buffer<streamData>Source_0_Sink_1;

#endif

