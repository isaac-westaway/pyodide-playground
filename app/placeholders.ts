export const placeholder1 =`import numpy as np # YOU MUST SELECT NUMPY FROM THE LIBRARY SELECTOR ABOVE`;

export const placeholder2 = `class Vector:
    def __init__(self, components):
        # Accepts any iterable of numbers, converts to numpy array of floats
        self._vec = np.array(components, dtype=float)
    
    def dot(self, other):
        if not isinstance(other, Vector):
            raise TypeError("Dot product requires another Vector instance")
        if self._vec.shape != other._vec.shape:
            raise ValueError("Vectors must be the same length for dot product")
        return np.dot(self._vec, other._vec)
    
    def norm(self):
        # Euclidean norm (magnitude) of the vector
        return np.linalg.norm(self._vec)
    
    def __add__(self, other):
        if not isinstance(other, Vector):
            raise TypeError("Can only add another Vector instance")
        return Vector(self._vec + other._vec)
    
    def __sub__(self, other):
        if not isinstance(other, Vector):
            raise TypeError("Can only subtract another Vector instance")
        return Vector(self._vec - other._vec)
    
    def __repr__(self):
        return f"Vector({self._vec})"
    
    # Optional: scalar multiplication
    def __mul__(self, scalar):
        if not isinstance(scalar, (int, float)):
            raise TypeError("Can only multiply by a scalar (int or float)")
        return Vector(self._vec * scalar)
    
    def __rmul__(self, scalar):
        return self.__mul__(scalar)
`;

export const placeholder3 = `v1 = Vector([1, 2, 3])
v2 = Vector([4, 5, 6])

print(v1)
print(v2)
print(v1 + v2)  # Should print Vector([5. 7. 9.])
`

export const placeholder4 = `print(v1.dot(v2))  # Should print 32.0
`;