function J = imnoise(I, type, varargin)
%IMNOISE Code Lab stand-in for the toolbox imnoise (uses ImageLab's noise models).
%   imnoise(I,'salt & pepper',d)  imnoise(I,'gaussian',m,v)

X = toDouble(I);
switch lower(strrep(type, ' ', ''))
    case {'salt&pepper', 'saltpepper'}, J = addSaltPepperNoise(X, pick(varargin, 1, 0.05));
    case 'gaussian',                     J = addGaussianNoise(X, pick(varargin, 1, 0), pick(varargin, 2, 0.01));
    otherwise
        error('ImageLab:shim', 'imnoise (Code Lab version) does not know the type "%s".', type);
end
if isa(I, 'uint8'), J = toUint8(J); end
end

function v = pick(c, k, d)
if numel(c) >= k && ~isempty(c{k}), v = double(c{k}); else, v = d; end
end
