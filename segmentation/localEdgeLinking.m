function [linked, candidates, M] = localEdgeLinking(I, TM, TA, K)
%LOCALEDGELINKING Edge linking by local processing (Gonzalez & Woods).
%   [linked, candidates, M] = localEdgeLinking(I, TM, TA, K)
%   TM - magnitude threshold, as a fraction of the largest gradient (0..1)
%   TA - angle tolerance in degrees
%   K  - longest gap (pixels) that is filled
%
%   Two pixels belong to the same edge when their gradient MAGNITUDES and
%   DIRECTIONS are similar. The simplified algorithm:
%     1. Sobel gradient: magnitude M and angle alpha
%     2. g = 1 where M > TM and alpha is within TA of the wanted direction
%        A = 90 deg (gradient vertical = HORIZONTAL edges)
%     3. scan every row of g and fill gaps of at most K zeros
%     4. repeat with A = 0 deg (vertical edges), scanning the columns
%     5. linked = OR of both results
%   candidates - the thresholded pixels of step 2 before the gaps are filled

if nargin < 2 || isempty(TM), TM = 0.3; end
if nargin < 3 || isempty(TA), TA = 45; end
if nargin < 4 || isempty(K), K = 5; end
G = toGray(I);
gx = filter2D(G, [-1 0 1; -2 0 2; -1 0 1]);         % d/dx (along the columns)
gy = filter2D(G, [-1 -2 -1; 0 0 0; 1 2 1]);         % d/dy (down the rows)
M = hypot(gx, gy);
alpha = mod(atan2d(gy, gx), 180);                   % direction 0..180
strong = M > TM * max(M(:));
horizontal = strong & abs(alpha - 90) <= TA;        % gradient ~ vertical
vertical = strong & min(alpha, 180 - alpha) <= TA;  % gradient ~ horizontal
candidates = horizontal | vertical;
linked = fillGaps(horizontal, K) | fillGaps(vertical', K)';
end

function g = fillGaps(g, K)
% Fill runs of at most K zeros that have an edge pixel on both sides (rows)
for r = 1:size(g, 1)
    on = find(g(r, :));
    if numel(on) < 2, continue; end
    gaps = find(diff(on) > 1 & diff(on) <= K + 1);
    for n = gaps
        g(r, on(n):on(n + 1)) = true;
    end
end
end
