function J = gaussianFilter(I, k, sigma)
%GAUSSIANFILTER Gaussian smoothing filter - TOOLBOX version.
%   J = gaussianFilter(I, k, sigma) smooths I with a k-by-k Gaussian kernel.
%   Larger sigma = stronger blur. Linear filter; a better low-pass smoother
%   than the box filter because its weights fall off smoothly.
%
%       h = fspecial('gaussian', k, sigma);
%       J = imfilter(I, h, 'replicate');

if nargin < 2 || isempty(k), k = 5; end
if nargin < 3 || isempty(sigma), sigma = 1; end
validateKernelSize(k);
I = toDouble(I);

if hasIPT()
    h = fspecial('gaussian', k, sigma);
    J = imfilter(I, h, 'replicate');
else
    J = filter2D(I, gaussianKernel(k, sigma), 'replicate');
end
end
