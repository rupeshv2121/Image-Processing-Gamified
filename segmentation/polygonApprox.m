function vertices = polygonApprox(boundary, tol)
%POLYGONAPPROX Polygonal approximation of a closed boundary by SPLITTING.
%   vertices = polygonApprox(boundary, tol) returns the indices (into the
%   n-by-2 boundary list) of the polygon corners, in boundary order.
%
%   Splitting technique (Gonzalez & Woods):
%     1. join the two boundary points that are farthest apart (P, Q):
%        the boundary is now two open curves
%     2. for each curve find the point with the largest perpendicular
%        distance from the chord joining its ends
%     3. if that distance > tol, make it a vertex and split the curve
%        there; repeat until every curve fits its chord within tol
%   A smaller tol gives more vertices and a closer fit.

if nargin < 2 || isempty(tol), tol = 2; end
n = size(boundary, 1);
if n < 4
    vertices = (1:n)';
    return
end
% P = first point, Q = the boundary point farthest from it
d = hypot(boundary(:, 1) - boundary(1, 1), boundary(:, 2) - boundary(1, 2));
[~, q] = max(d);
vertices = [1; split(boundary, 1, q, tol); q; split(boundary, q, n + 1, tol)];
vertices = unique(vertices, 'stable');
end

function v = split(B, a, b, tol)
% Vertices strictly between indices a and b (b = n + 1 wraps to point 1)
n = size(B, 1);
idx = a + 1:b - 1;
if isempty(idx), v = zeros(0, 1); return; end
P = B(a, :);
Q = B(mod(b - 1, n) + 1, :);
pts = B(idx, :);
L = hypot(Q(1) - P(1), Q(2) - P(2));
if L < eps
    dist = hypot(pts(:, 1) - P(1), pts(:, 2) - P(2));
else
    dist = abs((Q(2) - P(2)) * (pts(:, 1) - P(1)) - (Q(1) - P(1)) * (pts(:, 2) - P(2))) / L;
end
[m, k] = max(dist);
if m <= tol
    v = zeros(0, 1);
else
    c = idx(k);
    v = [split(B, a, c, tol); c; split(B, c, b, tol)];
end
end
