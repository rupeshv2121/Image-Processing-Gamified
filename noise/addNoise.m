function J = addNoise(I, type, params)
%ADDNOISE Dispatch to one of the noise models.
%   J = addNoise(I, type, params)
%   type   : 'gaussian' | 'saltpepper' | 'rayleigh' | 'erlang' |
%            'exponential' | 'uniform'
%   params : struct with fields mean, variance, density, a, b
%            (missing -> default)

if nargin < 3 || isempty(params), params = struct(); end
switch lower(strrep(strrep(type, ' ', ''), '&', ''))
    case 'gaussian'
        J = addGaussianNoise(I, getField(params, 'mean', 0), getField(params, 'variance', 0.01));
    case {'saltpepper', 'sp', 'impulse'}
        J = addSaltPepperNoise(I, getField(params, 'density', 0.05));
    case 'rayleigh'
        J = addRayleighNoise(I, getField(params, 'a', 0), getField(params, 'b', 0.01));
    case {'erlang', 'gamma'}
        J = addErlangNoise(I, getField(params, 'a', 20), getField(params, 'b', 2));
    case 'exponential'
        J = addExponentialNoise(I, getField(params, 'a', 10));
    case 'uniform'
        J = addUniformNoise(I, getField(params, 'a', -0.1), getField(params, 'b', 0.1));
    otherwise
        error('ImageLab:invalidParameter', 'Unknown noise type "%s".', type);
end
end

function v = getField(s, name, default)
if isfield(s, name) && ~isempty(s.(name)), v = double(s.(name)); else, v = default; end
end
