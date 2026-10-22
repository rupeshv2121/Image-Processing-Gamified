function [g, blurred] = degradeLPI(f, h, noiseVar)
%DEGRADELPI The degradation model  g(x,y) = h(x,y) * f(x,y) + eta(x,y).
%   [g, blurred] = degradeLPI(f, h, noiseVar)
%   f        - original image (double, [0,1])
%   h        - PSF of the linear, position-invariant (LPI) system (blurPSF)
%   noiseVar - variance of the additive Gaussian noise eta (0 = blur only)
%
%   LINEAR: H[a f1 + b f2] = a H[f1] + b H[f2].
%   POSITION-INVARIANT: shifting the input only shifts the output, so the
%   same PSF applies everywhere and the degradation is a convolution.

if nargin < 3 || isempty(noiseVar), noiseVar = 0; end
blurred = blurImage(toDouble(f), h);
g = blurred;
if noiseVar > 0
    g = g + sqrt(noiseVar) * randn(size(g));
end
g = min(max(g, 0), 1);
end
