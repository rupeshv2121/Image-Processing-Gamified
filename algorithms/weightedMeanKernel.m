function K = weightedMeanKernel(k)
%WEIGHTEDMEANKERNEL Weighted-average kernel built from binomial coefficients.
%   For k = 3 this is the classic kernel
%
%       1/16 * [1 2 1
%               2 4 2
%               1 2 1]
%
%   The centre pixel gets the largest weight and the weights fall off with
%   distance, so the filter blurs less than a plain box filter.

if nargin < 1 || isempty(k), k = 3; end
validateKernelSize(k);
row = arrayfun(@(n) nchoosek(k-1, n), 0:k-1);   % Pascal's triangle row
K = row' * row;                                  % outer product
K = K / sum(K(:));                               % weights sum to 1
end
