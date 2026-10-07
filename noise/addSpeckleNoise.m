function J = addSpeckleNoise(I, noiseVar)
%ADDSPECKLENOISE Multiplicative (speckle) noise: J = I + n .* I.
%   n is uniform with mean 0 and variance VAR. Brighter pixels receive more
%   noise. Typical of ultrasound, radar (SAR) and laser images.
%       J = imnoise(I, 'speckle', var);

if nargin < 2 || isempty(noiseVar), noiseVar = 0.04; end
if noiseVar < 0, error('ImageLab:invalidParameter', 'Variance must be >= 0.'); end
I = toDouble(I);
if hasIPT()
    J = imnoise(I, 'speckle', noiseVar);
else
    n = sqrt(12 * noiseVar) * (rand(size(I)) - 0.5);   % uniform, variance = var
    J = min(max(I + n .* I, 0), 1);
end
end
