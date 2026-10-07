function J = orderStatisticFilter(I, k, rank)
%ORDERSTATISTICFILTER Rank (order-statistic) filter - TOOLBOX version.
%   J = orderStatisticFilter(I, k, rank) sorts every k-by-k neighbourhood and
%   keeps the element at position RANK (1 = smallest, k^2 = largest):
%
%       rank = 1            -> minimum filter
%       rank = ceil(k^2/2)  -> median filter
%       rank = k^2          -> maximum filter
%
%       J = ordfilt2(I, rank, true(k), 'symmetric');

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
N = k * k;
if nargin < 3 || isempty(rank), rank = ceil(N / 2); end
if ~isscalar(rank) || rank ~= round(rank) || rank < 1 || rank > N
    error('ImageLab:invalidParameter', ...
        'Rank must be an integer between 1 and %d for a %dx%d window.', N, k, k);
end
I = toDouble(I);

if hasIPT()
    J = applyPerChannel(@(X) ordfilt2(X, rank, true(k), 'symmetric'), I);
else
    J = applyPerChannel(@(X) pickRank(X, k, rank), I);
end
end

function Y = pickRank(X, k, rank)
S = sort(neighborhoodStack(X, k, k, 'symmetric'), 3);
Y = S(:,:,rank);
end
