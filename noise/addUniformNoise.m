function J = addUniformNoise(I, a, b)
%ADDUNIFORMNOISE Additive uniform noise (Gonzalez & Woods, noise models).
%   J = addUniformNoise(I, a, b) adds z uniformly distributed in [a, b]
%
%       p(z) = 1 / (b - a)   for a <= z <= b
%       mean = (a + b)/2,   variance = (b - a)^2 / 12
%
%   Rarely found in practice, but the basis of many random number generators
%   and useful in simulations.

if nargin < 2 || isempty(a), a = -0.1; end
if nargin < 3 || isempty(b), b = 0.1; end
if b <= a, error('ImageLab:invalidParameter', 'b must be larger than a.'); end
I = toDouble(I);
z = a + (b - a) * rand(size(I));
J = min(max(I + z, 0), 1);
end
