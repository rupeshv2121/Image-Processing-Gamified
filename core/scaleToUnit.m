function J = scaleToUnit(I)
%SCALETOUNIT Linearly rescale any real array to [0,1] for display.
%   Used for signed results such as Laplacian or gradient images, which
%   contain negative values that cannot be displayed directly.

I = double(I);
lo = min(I(:));
hi = max(I(:));
if hi - lo < eps
    J = zeros(size(I));
else
    J = (I - lo) / (hi - lo);
end
end
