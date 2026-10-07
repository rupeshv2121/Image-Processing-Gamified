function [K, description] = kernelPresets(name, k)
%KERNELPRESETS Standard spatial-filter kernels used in the Kernel Playground.
%   [K, description] = kernelPresets(name, k)
%
%   name: 'mean', 'weighted', 'gaussian', 'sobelx', 'sobely', 'prewittx',
%         'prewitty', 'laplacian', 'laplacian8', 'sharpen', 'emboss',
%         'identity', 'pointdetect'
%   k   : kernel size (3, 5 or 7). Derivative kernels are defined at 3x3 and
%         are zero-padded to k x k so they can be edited in a larger grid.
%   With no arguments, returns the list of preset names.

if nargin == 0
    K = {'mean', 'weighted', 'gaussian', 'sobelx', 'sobely', 'prewittx', ...
         'prewitty', 'laplacian', 'laplacian8', 'sharpen', 'emboss', ...
         'identity', 'pointdetect'};
    description = '';
    return
end
if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);

switch lower(name)
    case 'mean'
        K = ones(k) / k^2;
        description = 'Box filter: every neighbour has equal weight 1/N. Smooths noise, blurs edges.';
    case 'weighted'
        K = weightedMeanKernel(k);
        description = 'Weighted average (binomial): centre counts most. Gentler blur than the box filter.';
    case 'gaussian'
        K = gaussianKernel(k, max(k / 6, 0.5));
        description = 'Gaussian: smooth bell-shaped weights (sigma = k/6). Best general-purpose smoother.';
    case 'sobelx'
        K = embed([-1 0 1; -2 0 2; -1 0 1], k);
        description = 'Sobel X: horizontal intensity change -> responds to VERTICAL edges. Weights 1-2-1 add smoothing.';
    case 'sobely'
        K = embed([-1 -2 -1; 0 0 0; 1 2 1], k);
        description = 'Sobel Y: vertical intensity change -> responds to HORIZONTAL edges.';
    case 'prewittx'
        K = embed([-1 0 1; -1 0 1; -1 0 1], k);
        description = 'Prewitt X: like Sobel X but with equal weights (less noise smoothing).';
    case 'prewitty'
        K = embed([-1 -1 -1; 0 0 0; 1 1 1], k);
        description = 'Prewitt Y: responds to horizontal edges with equal weights.';
    case 'laplacian'
        K = embed([0 1 0; 1 -4 1; 0 1 0], k);
        description = 'Laplacian (4-neighbour): second derivative. Zero in flat areas, strong at edges and points.';
    case 'laplacian8'
        K = embed([1 1 1; 1 -8 1; 1 1 1], k);
        description = 'Laplacian (8-neighbour): includes the diagonals, isotropic in 45-degree steps.';
    case 'sharpen'
        K = embed([0 -1 0; -1 5 -1; 0 -1 0], k);
        description = 'Sharpening: identity minus Laplacian, g = f - lap(f). Enhances edges and fine detail.';
    case 'emboss'
        K = embed([-2 -1 0; -1 1 1; 0 1 2], k);
        description = 'Emboss: directional derivative plus the original - gives a 3-D relief look.';
    case 'identity'
        K = embed(1, k);
        description = 'Identity: a single 1 at the centre. Output equals input.';
    case 'pointdetect'
        K = embed([-1 -1 -1; -1 8 -1; -1 -1 -1], k);
        description = 'Point detector: strong response to isolated points that differ from their surroundings.';
    otherwise
        error('ImageLab:invalidParameter', 'Unknown kernel preset "%s".', name);
end
end

function K = embed(small, k)
% Place a small kernel at the centre of a k-by-k zero matrix.
s = size(small, 1);
if k < s
    error('ImageLab:invalidKernelSize', 'This preset needs a kernel of at least %dx%d.', s, s);
end
K = zeros(k);
o = (k - s) / 2;
K(o+1:o+s, o+1:o+s) = small;
end
