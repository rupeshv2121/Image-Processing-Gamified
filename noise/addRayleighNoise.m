function J = addRayleighNoise(I, a, b)
%ADDRAYLEIGHNOISE Additive Rayleigh noise (Gonzalez & Woods, noise models).
%   J = addRayleighNoise(I, a, b) adds z with the Rayleigh PDF
%
%       p(z) = (2/b)(z - a) exp(-(z - a)^2 / b)   for z >= a
%       mean = a + sqrt(pi*b/4),   variance = b(4 - pi)/4
%
%   The PDF is skewed to the right - typical of range (radar) imaging.
%   Generated from a uniform U in (0,1):  z = a + sqrt(-b * ln(1 - U)).

if nargin < 2 || isempty(a), a = 0; end
if nargin < 3 || isempty(b), b = 0.01; end
if b <= 0, error('ImageLab:invalidParameter', 'b must be > 0.'); end
I = toDouble(I);
z = a + sqrt(-b * log(1 - rand(size(I))));
J = min(max(I + z, 0), 1);
end
