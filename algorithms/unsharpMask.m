function [G, mask] = unsharpMask(I, sigma, amount)
%UNSHARPMASK Unsharp masking.
%   1. blur the image                    blurred = Gaussian(I)
%   2. subtract to get the "mask"        mask    = I - blurred   (the detail)
%   3. add the mask back                 G       = I + amount * mask
%
%   amount = 1 is classic unsharp masking; amount > 1 is high-boost.

if nargin < 2 || isempty(sigma), sigma = 1.5; end
if nargin < 3 || isempty(amount), amount = 1; end
if sigma <= 0, error('ImageLab:invalidParameter', 'Sigma must be positive.'); end
I = toDouble(I);
k = min(2 * ceil(2 * sigma) + 1, 31);
blurred = gaussianFilter(I, k, sigma);
mask = I - blurred;
G = min(max(I + amount * mask, 0), 1);
end
