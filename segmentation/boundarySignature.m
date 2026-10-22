function [r, angles] = boundarySignature(boundary, centroid)
%BOUNDARYSIGNATURE Distance-versus-angle signature of a boundary.
%   [r, angles] = boundarySignature(boundary, centroid)
%   boundary - n-by-2 [row col] boundary pixels (e.g. from chainCode)
%   centroid - [row col] of the region (default: mean of the boundary)
%   r(k)     - distance from the centroid to the boundary at angles(k)
%              (0..359 degrees, counted anticlockwise from east)
%
%   A signature turns a 2-D boundary into a 1-D function: a circle gives a
%   constant, a square four equal humps. It is translation invariant;
%   rotation only shifts it along the angle axis, and dividing by max(r)
%   makes it scale invariant. Where a ray crosses the boundary more than
%   once (non-convex shapes) the farthest point is used.

if nargin < 2 || isempty(centroid), centroid = mean(boundary, 1); end
dy = -(boundary(:, 1) - centroid(1));               % rows grow downwards
dx = boundary(:, 2) - centroid(2);
a = mod(atan2d(dy, dx), 360);
d = hypot(dx, dy);
angles = 0:359;
bin = mod(round(a), 360) + 1;
r = accumarray(bin, d, [360 1], @max, NaN)';
% angles that no boundary pixel hit: interpolate circularly
known = find(~isnan(r));
if isempty(known)
    r = zeros(1, 360);
elseif numel(known) < 360
    ext = [known - 360, known, known + 360];
    r = interp1(ext, repmat(r(known), 1, 3), 1:360, 'linear');
end
end
