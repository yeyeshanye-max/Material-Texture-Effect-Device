export const invertMask = (mask: Float32Array): Float32Array => {
  const output = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    output[i] = 1 - mask[i];
  }
  return output;
};
