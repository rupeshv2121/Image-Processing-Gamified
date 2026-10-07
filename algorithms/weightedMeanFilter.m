function J = weightedMeanFilter(I, k)
%WEIGHTEDMEANFILTER Weighted mean (binomial) smoothing filter.
%   J = weightedMeanFilter(I, k) correlates I with weightedMeanKernel(k).
%   Linear filter; pixels closer to the centre contribute more.

if nargin < 2 || isempty(k), k = 3; end
J = filter2D(I, weightedMeanKernel(k), 'replicate');
end
