function [L, meanImage, numRegions] = splitAndMerge(I, stdThreshold, minBlock, mergeThreshold)
%SPLITANDMERGE Region splitting and merging (quadtree).
%   SPLIT : a block is split into four quadrants while it is not
%           homogeneous (std > stdThreshold) and larger than minBlock.
%   MERGE : neighbouring blocks whose mean intensities differ by less than
%           mergeThreshold are joined into one region.
%
%   Returns the label image L, an image where every region is painted with
%   its mean intensity, and the final number of regions.

if nargin < 2 || isempty(stdThreshold), stdThreshold = 0.05; end
if nargin < 3 || isempty(minBlock), minBlock = 8; end
if nargin < 4 || isempty(mergeThreshold), mergeThreshold = 0.08; end
G = toGray(I);
[h, w] = size(G);

% ---- SPLIT (iterative quadtree using a stack of blocks [r c height width])
blocks = zeros(0, 4);
stack = [1 1 h w];
while ~isempty(stack)
    b = stack(end, :); stack(end, :) = [];
    region = G(b(1):b(1)+b(3)-1, b(2):b(2)+b(4)-1);
    if std(region(:)) > stdThreshold && b(3) > minBlock && b(4) > minBlock
        h1 = floor(b(3)/2); w1 = floor(b(4)/2);
        stack = [stack; ...
            b(1)    b(2)    h1      w1; ...
            b(1)    b(2)+w1 h1      b(4)-w1; ...
            b(1)+h1 b(2)    b(3)-h1 w1; ...
            b(1)+h1 b(2)+w1 b(3)-h1 b(4)-w1]; %#ok<AGROW>
    else
        blocks(end+1, :) = b; %#ok<AGROW>
    end
end

nBlocks = size(blocks, 1);
B = zeros(h, w);
blockMean = zeros(nBlocks, 1);
for n = 1:nBlocks
    rows = blocks(n,1):blocks(n,1)+blocks(n,3)-1;
    cols = blocks(n,2):blocks(n,2)+blocks(n,4)-1;
    B(rows, cols) = n;
    blockMean(n) = mean(reshape(G(rows, cols), [], 1));
end

% ---- MERGE (union-find over adjacent blocks with similar means)
pairs = [reshape(B(:, 1:end-1), [], 1) reshape(B(:, 2:end), [], 1); ...
         reshape(B(1:end-1, :), [], 1) reshape(B(2:end, :), [], 1)];
pairs = unique(sort(pairs(pairs(:,1) ~= pairs(:,2), :), 2), 'rows');
parent = 1:nBlocks;
regionSum = blockMean .* (blocks(:,3) .* blocks(:,4));
regionCount = blocks(:,3) .* blocks(:,4);
for t = 1:size(pairs, 1)
    a = findRoot(parent, pairs(t, 1));
    b = findRoot(parent, pairs(t, 2));
    if a ~= b && abs(regionSum(a)/regionCount(a) - regionSum(b)/regionCount(b)) < mergeThreshold
        parent(b) = a;
        regionSum(a) = regionSum(a) + regionSum(b);
        regionCount(a) = regionCount(a) + regionCount(b);
    end
end
roots = arrayfun(@(n) findRoot(parent, n), 1:nBlocks);
[~, ~, newLabel] = unique(roots);
L = reshape(newLabel(B), h, w);
numRegions = max(L(:));
regionMeans = accumarray(L(:), G(:), [], @mean);
meanImage = regionMeans(L);
end

function r = findRoot(parent, n)
r = n;
while parent(r) ~= r
    r = parent(r);
end
end
