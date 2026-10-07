function J = addNoise(I, type, params)
%ADDNOISE Dispatch to one of the noise models.
%   J = addNoise(I, type, params)
%   type   : 'gaussian' | 'saltpepper' | 'speckle' | 'poisson'
%   params : struct with fields mean, variance, density (missing -> default)

if nargin < 3 || isempty(params), params = struct(); end
switch lower(strrep(strrep(type, ' ', ''), '&', ''))
    case 'gaussian'
        J = addGaussianNoise(I, getField(params, 'mean', 0), getField(params, 'variance', 0.01));
    case {'saltpepper', 'sp', 'impulse'}
        J = addSaltPepperNoise(I, getField(params, 'density', 0.05));
    case 'speckle'
        J = addSpeckleNoise(I, getField(params, 'variance', 0.04));
    case 'poisson'
        J = addPoissonNoise(I);
    otherwise
        error('ImageLab:invalidParameter', 'Unknown noise type "%s".', type);
end
end

function v = getField(s, name, default)
if isfield(s, name) && ~isempty(s.(name)), v = double(s.(name)); else, v = default; end
end
