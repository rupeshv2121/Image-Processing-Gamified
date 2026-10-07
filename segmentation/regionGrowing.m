function [BW, regionMean] = regionGrowing(I, seedRow, seedCol, tolerance, conn)
%REGIONGROWING Grow a region from a seed pixel.
%   Start at the seed and repeatedly add neighbouring pixels whose
%   intensity differs from the SEED intensity by at most TOLERANCE.
%   Uses a queue (breadth-first search) - plain MATLAB matrix operations.
%
%   tolerance in [0,1], conn = 4 or 8 (default 8).

if nargin < 4 || isempty(tolerance), tolerance = 0.1; end
if nargin < 5 || isempty(conn), conn = 8; end
G = toGray(I);
[h, w] = size(G);
if seedRow < 1 || seedRow > h || seedCol < 1 || seedCol > w
    error('ImageLab:invalidParameter', 'The seed point lies outside the image.');
end
seedRow = round(seedRow); seedCol = round(seedCol);

if conn == 4
    offsets = [-1 0; 1 0; 0 -1; 0 1];
else
    offsets = [-1 -1; -1 0; -1 1; 0 -1; 0 1; 1 -1; 1 0; 1 1];
end

seedValue = G(seedRow, seedCol);
BW = false(h, w);
BW(seedRow, seedCol) = true;
queue = zeros(h * w, 2);
queue(1, :) = [seedRow seedCol];
head = 1; tail = 1;

while head <= tail
    r = queue(head, 1); c = queue(head, 2); head = head + 1;
    for t = 1:size(offsets, 1)
        rr = r + offsets(t, 1);
        cc = c + offsets(t, 2);
        if rr >= 1 && rr <= h && cc >= 1 && cc <= w && ~BW(rr, cc) ...
                && abs(G(rr, cc) - seedValue) <= tolerance
            BW(rr, cc) = true;              % similar -> joins the region
            tail = tail + 1;
            queue(tail, :) = [rr cc];
        end
    end
end
regionMean = mean(G(BW));
end
