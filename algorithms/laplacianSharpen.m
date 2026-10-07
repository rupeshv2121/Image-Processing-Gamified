function [G, L, K] = laplacianSharpen(I, alpha, strength, useEight)
%LAPLACIANSHARPEN Image sharpening with the Laplacian.
%   [G, L, K] = laplacianSharpen(I, alpha, strength, useEight)
%
%       L = I (*) K                  % Laplacian = edge / detail image
%       G = I - strength * L         % subtract because K has a NEGATIVE centre
%
%   Adding the second derivative back to the image boosts intensity changes,
%   making edges and fine detail crisper, while flat regions (L = 0) are
%   unchanged.
%
%   alpha    : shape parameter of fspecial('laplacian', alpha)  (default 0.2)
%   strength : how much detail to add                           (default 1)
%   useEight : true -> use the 8-neighbour kernel [1 1 1; 1 -8 1; 1 1 1]
%
%   Returns the sharpened image G, the raw Laplacian L (signed) and kernel K.

if nargin < 2 || isempty(alpha), alpha = 0.2; end
if nargin < 3 || isempty(strength), strength = 1; end
if nargin < 4 || isempty(useEight), useEight = false; end
I = toDouble(I);

if useEight
    K = [1 1 1; 1 -8 1; 1 1 1];
elseif hasIPT()
    K = fspecial('laplacian', alpha);
else
    K = laplacianKernel(alpha);
end

L = filter2D(I, K, 'replicate');
G = min(max(I - strength * L, 0), 1);
end
