function bindVector(x, y, magnitude = 1) {
  //scale x and y to values < 1
  if (x != 0 || y != 0) {
    let scaler = magnitude /
      Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    x *= scaler;
    y *= scaler;
  } else {
    x = x <= -magnitude ? -magnitude : x >= magnitude ? magnitude : x;
    y = y <= -magnitude ? -magnitude : y >= magnitude ? magnitude : y;
  }

  return [x, y];
}
