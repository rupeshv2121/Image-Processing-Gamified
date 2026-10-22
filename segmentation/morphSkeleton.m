function [S, K] = morphSkeleton(A, B)
%MORPHSKELETON Skeleton (medial axis) of a binary region - a regional descriptor.
%   [S, K] = morphSkeleton(A, B)     B = structuring element (default 3x3 square)
%
%       S(A)   = union over k = 0..K of S_k(A)
%       S_k(A) = (A eroded k times by B) - opening of that result by B
%
%   K is the last step before A erodes away completely. The skeleton is
%   the set of centres of the largest discs that fit inside the region -
%   a thin "stick figure" that represents its shape. It is not guaranteed
%   to be connected.
%       S = bwmorph(A, 'skel', Inf);    % toolbox (thinning, connected)
%
%   Erosion keeps a pixel only if B, centred there, fits inside A;
%   dilation turns a pixel on if B touches A. Both are written here with
%   one shifted copy of the image per element of B.

if nargin < 2 || isempty(B), B = true(3); end
B = logical(B);
% pad with background so a region touching the image border still erodes away
p = (size(B) - 1) / 2;
P = false(size(A) + 2 * p);
P(p(1) + 1:end - p(1), p(2) + 1:end - p(2)) = logical(A);
[dr, dc] = find(B);
dr = dr - p(1) - 1;
dc = dc - p(2) - 1;

S = false(size(P));
E = P;
K = 0;
while any(E(:))
    S = S | (E & ~dilate(erode(E)));
    E = erode(E);
    if any(E(:)), K = K + 1; end
end
S = S(p(1) + 1:end - p(1), p(2) + 1:end - p(2));

    function Y = erode(X)
        Y = X;
        for n = 1:numel(dr), Y = Y & shift(X, dr(n), dc(n)); end
    end

    function Y = dilate(X)
        Y = X;
        for n = 1:numel(dr), Y = Y | shift(X, -dr(n), -dc(n)); end
    end
end

function Y = shift(X, r, c)
% Y(i, j) = X(i + r, j + c), false outside the image
Y = false(size(X));
[h, w] = size(X);
rs = max(1, 1 - r):min(h, h - r);
cs = max(1, 1 - c):min(w, w - c);
Y(rs, cs) = X(rs + r, cs + c);
end
