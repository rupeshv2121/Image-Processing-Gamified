function mse = calculateMSE(A, ref)
%CALCULATEMSE Mean squared error between an image and a reference.
%       MSE = (1/N) * sum( (A - ref).^2 )
%   Computed on [0,1] doubles. 0 = identical images; larger = worse.

A = toDouble(A);
ref = toDouble(ref);
assertSameSize(A, ref);
if hasIPT()
    mse = immse(A, ref);
else
    d = A - ref;
    mse = mean(d(:).^2);
end
end

function assertSameSize(A, B)
if ~isequal(size(A), size(B))
    error('ImageLab:sizeMismatch', 'Images must have the same size to be compared.');
end
end
