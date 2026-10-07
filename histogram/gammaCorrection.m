function J = gammaCorrection(I, gamma, c)
%GAMMACORRECTION Power-law (gamma) transformation:  s = c * r^gamma.
%   gamma < 1 brightens dark regions (expands dark grey levels)
%   gamma > 1 darkens the image (expands bright grey levels)

if nargin < 2 || isempty(gamma), gamma = 0.5; end
if nargin < 3 || isempty(c), c = 1; end
if gamma <= 0, error('ImageLab:invalidParameter', 'Gamma must be positive.'); end
J = min(max(c * toDouble(I).^gamma, 0), 1);
end
