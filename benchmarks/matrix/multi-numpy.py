#!/usr/bin/env python
# coding=utf-8

import numpy as np
import time

n_a_rows = 2000
n_a_cols = n_a_rows
n_b_rows = n_a_rows
n_b_cols = n_b_rows

a = np.arange(n_a_rows * n_a_cols).reshape(n_a_rows, n_a_cols)*1.0
b = np.arange(n_b_rows * n_b_cols).reshape(n_b_rows, n_b_cols)*1.0
print(a.dtype)

start = time.time()
for j in range(40):
    a = np.dot(a, b)
    a = np.dot(a, b)
    a = np.dot(a, b)
    a = np.dot(a, b)
end = time.time()

print("double time : {}".format(end - start))