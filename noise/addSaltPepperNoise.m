function J = addSaltPepperNoise(I, density)
%ADDSALTPEPPERNOISE Impulse (salt & pepper) noise.
%   A fraction DENSITY of the pixels is replaced: half by 0 (pepper), half by
%   1 (salt). Models transmission errors and faulty sensor elements.
%       J = imnoise(I, 'salt & pepper', density);     % toolbox
%   Manual: draw a uniform random number per pixel;
%       r < d/2        -> pepper (0)
%       d/2 <= r < d   -> salt   (1)

if nargin < 2 || isempty(density), density = 0.05; end
if density < 0 || density > 1
    error('ImageLab:invalidParameter', 'Noise density must be between 0 and 1.');
end
I = toDouble(I);
if hasIPT()
    J = imnoise(I, 'salt & pepper', density);
else
    J = I;
    r = rand(size(I));
    J(r < density / 2) = 0;
    J(r >= density / 2 & r < density) = 1;
end
end
