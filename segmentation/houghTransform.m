function [H, theta, rho] = houghTransform(BW, thetaStep)
%HOUGHTRANSFORM Standard Hough transform of a binary edge image.
%   [H, theta, rho] = houghTransform(BW, thetaStep)
%
%   Every line is written in normal form  rho = x cos(theta) + y sin(theta)
%   (x = column - 1, y = row - 1, theta in [-90, 90) degrees). Each edge
%   pixel votes for all (rho, theta) cells of the lines through it - one
%   sinusoid in parameter space. Collinear pixels vote for the SAME cell,
%   so peaks of the accumulator H are the lines of the image.
%       [H, theta, rho] = hough(BW);              % toolbox

if nargin < 2 || isempty(thetaStep), thetaStep = 1; end
BW = logical(BW);
[M, N] = size(BW);
D = ceil(hypot(M - 1, N - 1));
theta = -90:thetaStep:90 - thetaStep;
rho = -D:D;
[r, c] = find(BW);
x = c - 1; y = r - 1;
H = zeros(numel(rho), numel(theta));
for t = 1:numel(theta)
    rr = round(x * cosd(theta(t)) + y * sind(theta(t))) + D + 1;
    H(:, t) = accumarray(rr, 1, [numel(rho) 1]);
end
end
