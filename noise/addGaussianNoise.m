function J = addGaussianNoise(I, noiseMean, noiseVar)
%ADDGAUSSIANNOISE Additive Gaussian noise: J = I + n,  n ~ N(mean, var).
%   Models electronic sensor noise. Every pixel gets a small random offset.
%       J = imnoise(I, 'gaussian', mean, var);       % toolbox
%       J = I + mean + sqrt(var) * randn(size(I));   % manual

if nargin < 2 || isempty(noiseMean), noiseMean = 0; end
if nargin < 3 || isempty(noiseVar), noiseVar = 0.01; end
if noiseVar < 0, error('ImageLab:invalidParameter', 'Variance must be >= 0.'); end
I = toDouble(I);
if hasIPT()
    J = imnoise(I, 'gaussian', noiseMean, noiseVar);
else
    J = I + noiseMean + sqrt(noiseVar) * randn(size(I));
    J = min(max(J, 0), 1);
end
end
