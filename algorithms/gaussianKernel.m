function G = gaussianKernel(k, sigma)
%GAUSSIANKERNEL Build a normalised k-by-k Gaussian kernel manually.
%   G = gaussianKernel(k, sigma) evaluates the 2-D Gaussian
%
%       G(x,y) = exp( -(x^2 + y^2) / (2*sigma^2) )
%
%   on a grid centred at 0, then divides by the sum so the weights add up to
%   1 (so filtering does not change the overall brightness). The result is
%   identical to fspecial('gaussian', k, sigma).

if nargin < 1 || isempty(k), k = 5; end
if nargin < 2 || isempty(sigma), sigma = 1; end
validateKernelSize(k);
if ~isscalar(sigma) || ~isfinite(sigma) || sigma <= 0
    error('ImageLab:invalidParameter', 'Sigma must be a positive number.');
end

r = (k - 1) / 2;
[x, y] = meshgrid(-r:r, -r:r);
G = exp(-(x.^2 + y.^2) / (2 * sigma^2));
G(G < eps * max(G(:))) = 0;             % same clean-up as fspecial
G = G / sum(G(:));
end
