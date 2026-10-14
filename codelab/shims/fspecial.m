function h = fspecial(type, varargin)
%FSPECIAL Code Lab stand-in for the toolbox fspecial (base MATLAB).
%   'average' [n] , 'gaussian' [n] sigma , 'laplacian' alpha ,
%   'log' [n] sigma , 'sobel' , 'prewitt' , 'unsharp' alpha

args = varargin;
switch lower(type)
    case 'average'
        n = pick(args, 1, 3); if isscalar(n), n = [n n]; end
        h = ones(n) / prod(n);
    case 'gaussian'
        n = pick(args, 1, 3);
        h = gaussianKernel(n(1), pick(args, 2, 0.5));
    case 'laplacian'
        h = laplacianKernel(pick(args, 1, 0.2));
    case 'log'
        n = pick(args, 1, 5);
        h = logKernel(n(1), pick(args, 2, 0.5));
    case 'sobel',   h = [1 2 1; 0 0 0; -1 -2 -1];
    case 'prewitt', h = [1 1 1; 0 0 0; -1 -1 -1];
    case 'unsharp'
        h = [0 0 0; 0 1 0; 0 0 0] - laplacianKernel(pick(args, 1, 0.2));
    otherwise
        error('ImageLab:shim', 'fspecial (Code Lab version) does not know the type "%s".', type);
end
end

function v = pick(c, k, d)
if numel(c) >= k && ~isempty(c{k}), v = double(c{k}); else, v = d; end
end
