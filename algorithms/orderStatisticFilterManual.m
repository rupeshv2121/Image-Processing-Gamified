function J = orderStatisticFilterManual(I, k, rank)
%ORDERSTATISTICFILTERMANUAL Rank filter written with explicit loops.
%   Same algorithm as the median filter, but any position of the sorted
%   window can be selected (1 = min, ceil(N/2) = median, N = max).

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
N = k * k;
if nargin < 3 || isempty(rank), rank = ceil(N / 2); end
if rank < 1 || rank > N || rank ~= round(rank)
    error('ImageLab:invalidParameter', 'Rank must be an integer between 1 and %d.', N);
end
I = toDouble(I);
[h, w, nc] = size(I);
r = floor(k / 2);
J = zeros(h, w, nc);

for c = 1:nc
    P = padImage(I(:,:,c), r, r, 'symmetric');
    for i = 1:h
        for j = 1:w
            window = P(i:i+2*r, j:j+2*r);
            sortedWindow = sort(window(:));
            J(i,j,c) = sortedWindow(rank);
        end
    end
end
end
