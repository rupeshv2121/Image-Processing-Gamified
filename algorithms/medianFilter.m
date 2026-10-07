function J = medianFilter(I, k)
%MEDIANFILTER Median filter - TOOLBOX version.
%   J = medianFilter(I, k) replaces every pixel by the MEDIAN of its k-by-k
%   neighbourhood. NON-LINEAR order-statistic filter.
%
%   Why it removes salt & pepper noise: an impulse pixel (0 or 255) is an
%   extreme value, so after sorting the window it ends up at one end of the
%   list and is never selected as the middle value. Edges are preserved
%   because the median is always one of the real neighbouring values - no
%   new in-between grey levels are created as with averaging.
%
%       J = medfilt2(I, [k k], 'symmetric');

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
I = toDouble(I);

if hasIPT()
    J = applyPerChannel(@(X) medfilt2(X, [k k], 'symmetric'), I);
else
    J = applyPerChannel(@(X) median(neighborhoodStack(X, k, k, 'symmetric'), 3), I);
end
end
