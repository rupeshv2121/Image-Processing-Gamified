function P = padarray(I, padSize, method, direction)
%PADARRAY Code Lab stand-in for the toolbox padarray (base MATLAB).
%   padarray(I, [r c])            zeros on both sides
%   padarray(I, [r c], v)         a constant, 'replicate', 'symmetric' or 'circular'
%   padarray(I, [r c], m, dir)    dir = 'both' (default), 'pre' or 'post'

if nargin < 3 || isempty(method), method = 0; end
if nargin < 4, direction = 'both'; end
if isscalar(padSize), padSize = [padSize 0]; end
r = padSize(1); c = padSize(2);
pre = ~strcmpi(direction, 'post'); post = ~strcmpi(direction, 'pre');
rows = (1 - r * pre):(size(I, 1) + r * post);
cols = (1 - c * pre):(size(I, 2) + c * post);
if ischar(method) || isstring(method)
    switch lower(method)
        case 'replicate'
            ri = min(max(rows, 1), size(I, 1)); ci = min(max(cols, 1), size(I, 2));
        case 'symmetric'
            ri = mirror(rows, size(I, 1)); ci = mirror(cols, size(I, 2));
        case 'circular'
            ri = mod(rows - 1, size(I, 1)) + 1; ci = mod(cols - 1, size(I, 2)) + 1;
        otherwise
            error('ImageLab:shim', 'padarray (Code Lab version) does not know "%s".', method);
    end
    P = I(ri, ci, :);
else
    P = repmat(cast(method, 'like', I), numel(rows), numel(cols), size(I, 3));
    P(rows >= 1 & rows <= size(I, 1), cols >= 1 & cols <= size(I, 2), :) = I;
end
end

function i = mirror(i, n)
p = mod(i - 1, 2 * n);
i = min(p, 2 * n - 1 - p) + 1;
end
