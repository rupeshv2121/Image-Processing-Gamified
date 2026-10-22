function J = geometricMeanFilter(I, k)
%GEOMETRICMEANFILTER Geometric mean filter (restoration filter).
%   J = geometricMeanFilter(I, k) replaces every pixel by the product of its
%   k-by-k neighbourhood raised to the power 1/k^2:
%
%       f(x,y) = [ prod g(s,t) ] ^ (1 / k^2)
%
%   Smooths about as much as the arithmetic mean but loses less detail.
%   Computed as exp(mean(log g)) - a box filter in the log domain. A single
%   pepper (0) pixel drives the product to 0, so it fails on pepper noise.

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
I = toDouble(I);
J = exp(filter2D(log(max(I, 1e-6)), ones(k) / k^2));
J = min(max(J, 0), 1);
end
