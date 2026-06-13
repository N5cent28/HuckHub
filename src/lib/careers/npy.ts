import fs from "fs";

/** Load a float32 2D matrix from a .npy file (NumPy v1.0, little-endian). */
export function loadNpyMatrix(filePath: string): Float32Array {
  const buf = fs.readFileSync(filePath);
  const magic = buf.subarray(0, 6).toString("latin1");
  if (magic !== "\x93NUMPY") {
    throw new Error(`Invalid NPY file: ${filePath}`);
  }
  const headerLen = buf.readUInt16LE(8);
  const header = buf.subarray(10, 10 + headerLen).toString("latin1");
  const shapeMatch = header.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!shapeMatch) {
    throw new Error(`Could not parse NPY shape from header: ${header}`);
  }
  const rows = parseInt(shapeMatch[1], 10);
  const cols = parseInt(shapeMatch[2], 10);
  const dataStart = 10 + headerLen;
  const data = buf.subarray(dataStart, dataStart + rows * cols * 4);
  return new Float32Array(data.buffer, data.byteOffset, rows * cols);
}

export function rowFromMatrix(matrix: Float32Array, index: number, dim: number): Float32Array {
  return matrix.subarray(index * dim, (index + 1) * dim);
}
