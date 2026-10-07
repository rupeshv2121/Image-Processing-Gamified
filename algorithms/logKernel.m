function K = logKernel(k, sigma)
%LOGKERNEL Laplacian of Gaussian (LoG) kernel, built manually.
%   Same formula as fspecial('log', k, sigma):
%       G   = exp(-(x^2+y^2)/(2 sigma^2)),  normalised
%       LoG = G .* (x^2 + y^2 - 2 sigma^2) / sigma^4
%   then shifted so the kernel sums to zero (no response in flat regions).
%   Smoothing (Gaussian) + second derivative (Laplacian) in one kernel.

if nargin < 2 || isempty(sigma), sigma = 0.5; end
if nargin < 1 || isempty(k), k = 2 * ceil(3 * sigma) + 1; end
validateKernelSize(k);
r = (k - 1) / 2;
[x, y] = meshgrid(-r:r, -r:r);
rr = x.^2 + y.^2;
G = exp(-rr / (2 * sigma^2));
G(G < eps * max(G(:))) = 0;
G = G / sum(G(:));
K = G .* (rr - 2 * sigma^2) / sigma^4;
K = K - sum(K(:)) / numel(K);
end
