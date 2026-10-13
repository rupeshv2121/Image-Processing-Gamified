function [code, boundary, startRC] = chainCode(BW)
%CHAINCODE Freeman 8-direction chain code of the outer boundary of a region.
%   [code, boundary, startRC] = chainCode(BW) traces the outer boundary of
%   the (first) object in the binary image BW.
%
%   code     - 1-by-n vector of directions 0..7, one per boundary step
%   boundary - n-by-2 [row col] list of the boundary pixels, in tracing order
%   startRC  - [row col] of the start pixel (top-most, then left-most)
%
%   Directions (rows grow downwards):      3  2  1
%                                          4  .  0
%                                          5  6  7
%
%   Algorithm (Moore-neighbour tracing, as in Sonka, Hlavac & Boyle):
%     1. start at the top-left object pixel, set dir = 7
%     2. search the 8 neighbours anticlockwise, starting at
%        (dir + 7) mod 8 if dir is even, (dir + 6) mod 8 if dir is odd
%     3. the first object pixel found is the next boundary pixel; its
%        direction is the next chain code element
%     4. stop when the current and previous pixel equal the second and
%        first boundary pixels again

BW = logical(BW);
code = zeros(1, 0);
boundary = zeros(0, 2);
startRC = zeros(1, 0);
idx = find(BW.', 1);                     % raster order: first row, then first column
if isempty(idx), return; end
[c0, r0] = ind2sub([size(BW, 2) size(BW, 1)], idx);
startRC = [r0 c0];

P = false(size(BW) + 2);                 % zero border so the search never leaves the array
P(2:end-1, 2:end-1) = BW;
dr = [0 -1 -1 -1  0  1  1  1];
dc = [1  1  0 -1 -1 -1  0  1];

cur = startRC + 1;
pts = cur;
dir = 7;
codes = zeros(1, 0);
for step = 1:(4 * nnz(BW) + 8)
    if mod(dir, 2) == 0, d = mod(dir + 7, 8); else, d = mod(dir + 6, 8); end
    found = false;
    for t = 0:7
        dd = mod(d + t, 8);
        nr = cur(1) + dr(dd + 1);
        nc = cur(2) + dc(dd + 1);
        if P(nr, nc), found = true; break; end
    end
    if ~found, break; end                % isolated single pixel: empty code
    dir = dd;
    cur = [nr nc];
    codes(end+1) = dir; %#ok<AGROW>
    pts(end+1, :) = cur; %#ok<AGROW>
    n = size(pts, 1);
    if n >= 3 && isequal(pts(n, :), pts(2, :)) && isequal(pts(n-1, :), pts(1, :))
        codes = codes(1:end-1);          % last move repeats the first one
        pts = pts(1:end-2, :);           % last two points repeat the first two
        break
    end
end
code = codes;
boundary = pts - 1;                      % back to unpadded coordinates
end
