function J = imfilter(I, K, varargin)
%IMFILTER Code Lab stand-in for the toolbox imfilter (base MATLAB).
%   J = imfilter(I, K)                  correlation, zero padding
%   J = imfilter(I, K, 'replicate')     also 'symmetric', 'circular', a number,
%                                       'conv', 'corr', 'same'
%   Only used while Code Lab code runs without the Image Processing Toolbox.

pad = 0; useConv = false;
for k = 1:numel(varargin)
    o = varargin{k};
    if isnumeric(o) && isscalar(o), pad = o;
    elseif any(strcmpi(o, {'replicate', 'symmetric', 'circular'})), pad = lower(o);
    elseif strcmpi(o, 'conv'), useConv = true;
    elseif any(strcmpi(o, {'corr', 'same'}))
    else, error('ImageLab:shim', 'imfilter (Code Lab version) does not support the option "%s".', string(o));
    end
end
K = double(K);
if useConv, K = rot90(K, 2); end
r = floor(size(K) / 2);
X = double(I);
if ischar(pad)
    if strcmp(pad, 'circular')
        rows = mod((-r(1):size(X, 1) + r(1) - 1), size(X, 1)) + 1;
        cols = mod((-r(2):size(X, 2) + r(2) - 1), size(X, 2)) + 1;
        X = X(rows, cols, :);
    else
        X = padImage(X, r(1), r(2), pad);
    end
else
    X = padImage(X - pad, r(1), r(2), 'zero') + pad;
end
J = zeros(size(I));
for c = 1:size(I, 3)
    % conv2 flips the kernel, so flip it back to get correlation
    J(:, :, c) = conv2(X(:, :, c), rot90(K, 2), 'valid');
end
J = J(1:size(I, 1), 1:size(I, 2), :);
if isinteger(I)
    J = cast(round(min(max(J, double(intmin(class(I)))), double(intmax(class(I))))), class(I));
elseif islogical(I)
    J = J > 0.5;
end
end
