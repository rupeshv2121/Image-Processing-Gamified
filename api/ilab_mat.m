function s = ilab_mat(M)
%ILAB_MAT Encode a matrix for JSON as {rows, cols, data (row-major)}.
%   jsonencode turns 1x1 or Nx1 matrices into scalars/flat arrays, which
%   loses the shape. This wrapper keeps it explicit for the user interface.

M = double(M);
s = struct('rows', size(M, 1), 'cols', size(M, 2), 'data', {num2cell(reshape(M.', 1, []))});
end
