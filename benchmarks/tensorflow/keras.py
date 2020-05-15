import tensorflow as tf
import time


mnist = tf.keras.datasets.mnist

(x_train, y_train),(x_test, y_test) = mnist.load_data()

# x_train, x_test = x_train / 255.0, x_test / 255.0

# model = tf.keras.models.Sequential([
#   tf.keras.layers.Flatten(input_shape=(28, 28)),
#   tf.keras.layers.Dense(784, activation='sigmoid'),
#   tf.keras.layers.Dense(784, activation='sigmoid'),
#   tf.keras.layers.Dense(784, activation='sigmoid'),
#   tf.keras.layers.Dense(784, activation='sigmoid')
# ])

# model.compile(optimizer='adam',
#               loss='sparse_categorical_crossentropy')

# #model.fit(x_train, y_train, epochs=5)
# #model.evaluate(x_test, y_test)

# start = time.time()
# model.fit(x_train, y_train, epochs=5)
# end = time.time()

# print("double time : {}".format(end - start))