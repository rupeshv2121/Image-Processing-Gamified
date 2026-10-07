function J = maxFilter(I, k)
%MAXFILTER Maximum filter (rank N order-statistic filter).
%   Replaces each pixel by the brightest value in its k-by-k neighbourhood.
%   Removes "pepper" (black) impulses, brightens and dilates bright regions.

if nargin < 2 || isempty(k), k = 3; end
J = orderStatisticFilter(I, k, k * k);
end
