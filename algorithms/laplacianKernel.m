function K = laplacianKernel(alpha)
%LAPLACIANKERNEL 3x3 Laplacian kernel, built manually (= fspecial('laplacian',alpha)).
%   The Laplacian is the second-order derivative
%
%       lap(f) = d2f/dx2 + d2f/dy2
%              ~ f(x+1,y)+f(x-1,y)+f(x,y+1)+f(x,y-1) - 4 f(x,y)
%
%   alpha in [0,1] controls the shape:
%       alpha = 0   -> [0 1 0; 1 -4 1; 0 1 0]    (4-neighbour Laplacian)
%       alpha = 1   -> [.5 0 .5; 0 -2 0; .5 0 .5] (diagonal only)
%   K = 4/(alpha+1) * [alpha/4      (1-alpha)/4  alpha/4
%                      (1-alpha)/4  -1           (1-alpha)/4
%                      alpha/4      (1-alpha)/4  alpha/4]

if nargin < 1 || isempty(alpha), alpha = 0.2; end
if ~isscalar(alpha) || alpha < 0 || alpha > 1
    error('ImageLab:invalidParameter', 'alpha must be between 0 and 1.');
end
corner = alpha / (alpha + 1);
edgeW  = (1 - alpha) / (alpha + 1);
centre = -4 / (alpha + 1);
K = [corner edgeW corner; edgeW centre edgeW; corner edgeW corner];
end
