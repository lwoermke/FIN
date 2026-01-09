/**
 * [2.1] Matrix Void
 * The 3D Tensor Output.
 * 
 * The Matrix-of-Matrices: A 3D Tensor T outputs the optimal weight vector.
 * This is the core structure for the Hierarchical CDEO (H-CDEO) optimization.
 */

/**
 * 3D Tensor class representing the Matrix-of-Matrices
 * Dimensions: [depth, height, width]
 */
export class MatrixVoid {
  private data: Float32Array;
  private depth: number;
  private height: number;
  private width: number;

  /**
   * Creates a new 3D tensor
   * @param depth Depth dimension
   * @param height Height dimension
   * @param width Width dimension
   * @param initialValue Initial value for all elements (default 0)
   */
  constructor(
    depth: number,
    height: number,
    width: number,
    initialValue: number = 0
  ) {
    if (depth <= 0 || height <= 0 || width <= 0) {
      throw new Error('Tensor dimensions must be positive');
    }
    
    this.depth = depth;
    this.height = height;
    this.width = width;
    this.data = new Float32Array(depth * height * width);
    
    if (initialValue !== 0) {
      this.data.fill(initialValue);
    }
  }

  /**
   * Gets the value at the specified indices
   * @param d Depth index
   * @param h Height index
   * @param w Width index
   * @returns Value at [d, h, w]
   */
  get(d: number, h: number, w: number): number {
    this.validateIndices(d, h, w);
    const index = d * this.height * this.width + h * this.width + w;
    return this.data[index];
  }

  /**
   * Sets the value at the specified indices
   * @param d Depth index
   * @param h Height index
   * @param w Width index
   * @param value Value to set
   */
  set(d: number, h: number, w: number, value: number): void {
    this.validateIndices(d, h, w);
    const index = d * this.height * this.width + h * this.width + w;
    this.data[index] = value;
  }

  /**
   * Validates tensor indices
   * @param d Depth index
   * @param h Height index
   * @param w Width index
   */
  private validateIndices(d: number, h: number, w: number): void {
    if (d < 0 || d >= this.depth ||
        h < 0 || h >= this.height ||
        w < 0 || w >= this.width) {
      throw new Error(`Index out of bounds: [${d}, ${h}, ${w}]`);
    }
  }

  /**
   * Gets a 2D slice at the specified depth
   * @param depthIndex Depth index
   * @returns 2D array representing the slice
   */
  getSlice(depthIndex: number): number[][] {
    if (depthIndex < 0 || depthIndex >= this.depth) {
      throw new Error(`Depth index out of bounds: ${depthIndex}`);
    }
    
    const slice: number[][] = [];
    for (let h = 0; h < this.height; h++) {
      const row: number[] = [];
      for (let w = 0; w < this.width; w++) {
        row.push(this.get(depthIndex, h, w));
      }
      slice.push(row);
    }
    return slice;
  }

  /**
   * Sets a 2D slice at the specified depth
   * @param depthIndex Depth index
   * @param slice 2D array to set
   */
  setSlice(depthIndex: number, slice: number[][]): void {
    if (depthIndex < 0 || depthIndex >= this.depth) {
      throw new Error(`Depth index out of bounds: ${depthIndex}`);
    }
    
    if (slice.length !== this.height) {
      throw new Error(`Slice height mismatch: expected ${this.height}, got ${slice.length}`);
    }
    
    for (let h = 0; h < this.height; h++) {
      if (slice[h].length !== this.width) {
        throw new Error(`Slice width mismatch at row ${h}: expected ${this.width}, got ${slice[h].length}`);
      }
      
      for (let w = 0; w < this.width; w++) {
        this.set(depthIndex, h, w, slice[h][w]);
      }
    }
  }

  /**
   * Gets the depth dimension
   * @returns Depth
   */
  getDepth(): number {
    return this.depth;
  }

  /**
   * Gets the height dimension
   * @returns Height
   */
  getHeight(): number {
    return this.height;
  }

  /**
   * Gets the width dimension
   * @returns Width
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Gets the total number of elements
   * @returns Total element count
   */
  size(): number {
    return this.depth * this.height * this.width;
  }

  /**
   * Gets the underlying data buffer
   * @returns Float32Array buffer
   */
  getData(): Float32Array {
    return this.data;
  }

  /**
   * Fills the tensor with a constant value
   * @param value Value to fill
   */
  fill(value: number): void {
    this.data.fill(value);
  }

  /**
   * Performs element-wise addition with another tensor
   * @param other Other tensor (must have same dimensions)
   * @returns New tensor with result
   */
  add(other: MatrixVoid): MatrixVoid {
    if (!this.hasSameShape(other)) {
      throw new Error('Tensors must have the same shape for addition');
    }
    
    const result = new MatrixVoid(this.depth, this.height, this.width);
    for (let i = 0; i < this.data.length; i++) {
      result.data[i] = this.data[i] + other.data[i];
    }
    return result;
  }

  /**
   * Performs element-wise multiplication with a scalar
   * @param scalar Scalar value
   * @returns New tensor with result
   */
  multiplyScalar(scalar: number): MatrixVoid {
    const result = new MatrixVoid(this.depth, this.height, this.width);
    for (let i = 0; i < this.data.length; i++) {
      result.data[i] = this.data[i] * scalar;
    }
    return result;
  }

  /**
   * Checks if another tensor has the same shape
   * @param other Other tensor
   * @returns True if shapes match
   */
  hasSameShape(other: MatrixVoid): boolean {
    return this.depth === other.depth &&
           this.height === other.height &&
           this.width === other.width;
  }

  /**
   * Computes the sum of all elements
   * @returns Sum
   */
  sum(): number {
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      sum += this.data[i];
    }
    return sum;
  }

  /**
   * Computes the mean of all elements
   * @returns Mean
   */
  mean(): number {
    return this.sum() / this.size();
  }

  /**
   * Computes the maximum value
   * @returns Maximum value
   */
  max(): number {
    let max = this.data[0];
    for (let i = 1; i < this.data.length; i++) {
      if (this.data[i] > max) {
        max = this.data[i];
      }
    }
    return max;
  }

  /**
   * Computes the minimum value
   * @returns Minimum value
   */
  min(): number {
    let min = this.data[0];
    for (let i = 1; i < this.data.length; i++) {
      if (this.data[i] < min) {
        min = this.data[i];
      }
    }
    return min;
  }

  /**
   * Extracts the optimal weight vector from the tensor
   * Typically, this is the last slice or a reduction operation
   * @returns Weight vector as 1D array
   */
  extractWeightVector(): number[] {
    // Extract from the last depth slice, averaging over height
    const weights: number[] = [];
    const lastDepth = this.depth - 1;
    
    for (let w = 0; w < this.width; w++) {
      let sum = 0;
      for (let h = 0; h < this.height; h++) {
        sum += this.get(lastDepth, h, w);
      }
      weights.push(sum / this.height);
    }
    
    return weights;
  }

  /**
   * Creates a copy of this tensor
   * @returns New tensor with copied data
   */
  clone(): MatrixVoid {
    const clone = new MatrixVoid(this.depth, this.height, this.width);
    clone.data.set(this.data);
    return clone;
  }
}
