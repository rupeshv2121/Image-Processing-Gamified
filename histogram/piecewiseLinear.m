function J = piecewiseLinear(I, r1, s1, r2, s2)
%PIECEWISELINEAR Piecewise-linear contrast stretching through (r1,s1), (r2,s2).
%   J = piecewiseLinear(I, r1, s1, r2, s2)    all values in [0,1], r1 <= r2
%
%   The transfer function joins (0,0) -> (r1,s1) -> (r2,s2) -> (1,1):
%     r1 = s1 and r2 = s2         identity (no change)
%     s1 = 0, s2 = 1, r1 < r2     contrast stretching of [r1, r2]
%     r1 = r2, s1 = 0, s2 = 1     thresholding (a binary image)
%   Colour images are transformed on the brightness only.

if nargin < 5
    error('ImageLab:invalidParameter', 'piecewiseLinear needs r1, s1, r2 and s2.');
end
if r1 > r2, [r1, r2] = deal(r2, r1); [s1, s2] = deal(s2, s1); end
J = applyToLuminance(@(X) transfer(X, r1, s1, r2, s2), I);
end

function Y = transfer(X, r1, s1, r2, s2)
Y = zeros(size(X));
low = X < r1;
mid = X >= r1 & X <= r2;
high = X > r2;
if r1 > 0, Y(low) = X(low) * s1 / r1; end
if r2 > r1
    Y(mid) = s1 + (X(mid) - r1) * (s2 - s1) / (r2 - r1);
else
    Y(mid) = s2;                                   % r1 = r2: a step (threshold)
end
if r2 < 1, Y(high) = s2 + (X(high) - r2) * (1 - s2) / (1 - r2); end
end
