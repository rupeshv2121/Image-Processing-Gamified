function [BW, thresholds, mag] = cannyManual(I, sigma, lowT, highT)
%CANNYMANUAL Canny edge detector implemented step by step.
%   [BW, thresholds, mag] = cannyManual(I, sigma, lowT, highT)
%
%   1. Smooth the image with a Gaussian (reduces noise).
%   2. Compute the gradient with Sobel kernels -> magnitude and direction.
%   3. Non-maximum suppression: keep a pixel only if it is the largest
%      along its gradient direction -> edges become 1 pixel thick.
%   4. Double threshold: strong edges (> highT) and weak edges (> lowT).
%   5. Hysteresis / edge linking: keep weak edges only if they are
%      connected to a strong edge.
%
%   Thresholds are fractions of the maximum gradient (0..1). If omitted they
%   are chosen like MATLAB's edge(): highT = level above which 30% of pixels
%   lie, lowT = 0.4 * highT.

if nargin < 2 || isempty(sigma), sigma = sqrt(2); end
G = toGray(I);
[h, w] = size(G);

% 1. Gaussian smoothing
k = min(2 * ceil(3 * sigma) + 1, 31);
S = filter2D(G, gaussianKernel(k, sigma), 'replicate');

% 2. Gradient
gx = filter2D(S, [-1 0 1; -2 0 2; -1 0 1], 'replicate');
gy = filter2D(S, [-1 -2 -1; 0 0 0; 1 2 1], 'replicate');
mag = hypot(gx, gy);
mag = mag / max(max(mag(:)), eps);
angle = mod(atan2d(gy, gx), 180);

% 3. Non-maximum suppression (direction quantised to 0/45/90/135 degrees)
P = padImage(mag, 1, 1, 'zero');
nb = @(dr, dc) P(2+dr:h+1+dr, 2+dc:w+1+dc);
d0   = angle < 22.5 | angle >= 157.5;
d45  = angle >= 22.5 & angle < 67.5;
d90  = angle >= 67.5 & angle < 112.5;
d135 = angle >= 112.5 & angle < 157.5;
isMax = (d0   & mag >= nb(0,-1)  & mag >= nb(0,1))  | ...
        (d45  & mag >= nb(-1,-1) & mag >= nb(1,1))  | ...
        (d90  & mag >= nb(-1,0)  & mag >= nb(1,0))  | ...
        (d135 & mag >= nb(-1,1)  & mag >= nb(1,-1));
thin = mag .* isMax;

% 4. Thresholds
if nargin < 4 || isempty(highT)
    counts = histcounts(mag(:), linspace(0, 1, 65));
    highT = find(cumsum(counts) > 0.7 * numel(mag), 1, 'first') / 64;
end
if nargin < 3 || isempty(lowT)
    lowT = 0.4 * highT;
end
if lowT >= highT
    error('ImageLab:invalidParameter', 'The low threshold must be smaller than the high threshold.');
end
strong = thin > highT;
weak   = thin > lowT;

% 5. Hysteresis: keep weak components that touch a strong pixel
[L, n] = labelComponents(weak, 8);
keepLabel = false(n + 1, 1);
keepLabel(unique(L(strong)) + 1) = true;
keepLabel(1) = false;                 % background
BW = keepLabel(L + 1);
thresholds = [lowT highT];
end
