function J = gaussianFilterManual(I, k, sigma)
%GAUSSIANFILTERMANUAL Gaussian filter with a hand-built kernel and loops.
%   1. Build the kernel from the Gaussian formula (gaussianKernel).
%   2. Slide it over the image and take the weighted sum (manualFilterLoop).

if nargin < 2 || isempty(k), k = 5; end
if nargin < 3 || isempty(sigma), sigma = 1; end
G = gaussianKernel(k, sigma);
J = manualFilterLoop(I, G, 'replicate');
end
