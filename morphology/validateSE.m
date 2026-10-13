function SE = validateSE(SE)
%VALIDATESE Check a structuring element and return it as a logical matrix.
%   SE = validateSE(SE) accepts any numeric or logical matrix with odd
%   dimensions (1..31). Non-zero entries belong to the element; the origin
%   is the centre element.

if ~(isnumeric(SE) || islogical(SE)) || isempty(SE) || ~ismatrix(SE)
    error('ImageLab:invalidSE', 'The structuring element must be a non-empty 2-D matrix of 0s and 1s.');
end
[h, w] = size(SE);
if mod(h, 2) == 0 || mod(w, 2) == 0 || h > 31 || w > 31
    error('ImageLab:invalidSE', ...
        'The structuring element needs odd dimensions up to 31x31 so it has a centre (got %dx%d).', h, w);
end
SE = SE ~= 0;
if ~any(SE(:))
    error('ImageLab:invalidSE', 'The structuring element must contain at least one 1.');
end
end
