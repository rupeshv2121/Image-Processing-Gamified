function J = harmonicMeanFilter(I, k)
%HARMONICMEANFILTER Harmonic mean filter (restoration filter).
%   J = harmonicMeanFilter(I, k):
%
%       f(x,y) = k^2 / sum( 1 / g(s,t) )
%
%   Works well for salt noise and Gaussian noise but fails for pepper noise
%   (1/0 dominates the sum). It is the contraharmonic filter with Q = -1.

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
I = toDouble(I);
J = 1 ./ filter2D(1 ./ max(I, 1e-6), ones(k) / k^2);
J = min(max(J, 0), 1);
end
