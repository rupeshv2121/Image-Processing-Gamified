function [out, steps, flippedKernel] = manualConvolution(I, K, shape, padMode)
%MANUALCONVOLUTION Spatial convolution = correlation with a FLIPPED kernel.
%   [out, steps, flippedKernel] = manualConvolution(I, K, shape, padMode)
%
%   Convolution is defined as
%
%       g(x,y) = sum_s sum_t  w(s,t) * f(x-s, y-t)
%
%   The minus signs mean the kernel is rotated by 180 degrees (flipped
%   horizontally AND vertically) before it is slid over the image:
%
%       flippedKernel = rot90(K, 2)     % == flipud(fliplr(K))
%
%   After that the computation is exactly the same as correlation.
%   For symmetric kernels (mean, Gaussian, Laplacian) correlation and
%   convolution give the same result; for Sobel/Prewitt they differ in sign.
%
%   Checks: for zero padding, out equals conv2(I, K, shape).

if nargin < 3 || isempty(shape), shape = 'same'; end
if nargin < 4 || isempty(padMode), padMode = 'zero'; end
K = validateKernel(K);

flippedKernel = rot90(K, 2);            % flip left-right and up-down
if nargout > 1
    [out, steps] = manualCorrelation(I, flippedKernel, shape, padMode);
else
    out = manualCorrelation(I, flippedKernel, shape, padMode);
end
end
