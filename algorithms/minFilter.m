function J = minFilter(I, k)
%MINFILTER Minimum filter (rank 1 order-statistic filter).
%   Replaces each pixel by the darkest value in its k-by-k neighbourhood.
%   Removes "salt" (white) impulses, darkens and erodes bright regions.

if nargin < 2 || isempty(k), k = 3; end
J = orderStatisticFilter(I, k, 1);
end
