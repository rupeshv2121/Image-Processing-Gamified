function SE = structuringElement(shape, n)
%STRUCTURINGELEMENT Binary structuring element (base-MATLAB version of strel).
%   SE = structuringElement(shape, n) returns an n-by-n logical matrix whose
%   origin is the centre element. n must be odd.
%
%   shape:
%     'square'  - all ones                       strel('square', n)
%     'disk'    - approximate digital disk        strel('disk', (n-1)/2)
%     'diamond' - |x| + |y| <= r                  strel('diamond', (n-1)/2)
%     'cross'   - the centre row and column (plus sign)
%     'hline'   - horizontal line                 strel('line', n, 0)
%     'vline'   - vertical line                   strel('line', n, 90)
%
%   Example (n = 5):
%       disk        diamond      cross
%     0 1 1 1 0    0 0 1 0 0    0 0 1 0 0
%     1 1 1 1 1    0 1 1 1 0    0 0 1 0 0
%     1 1 1 1 1    1 1 1 1 1    1 1 1 1 1
%     1 1 1 1 1    0 1 1 1 0    0 0 1 0 0
%     0 1 1 1 0    0 0 1 0 0    0 0 1 0 0

if nargin < 1 || isempty(shape), shape = 'square'; end
if nargin < 2 || isempty(n), n = 3; end
validateKernelSize(n);
r = (n - 1) / 2;
[x, y] = meshgrid(-r:r, -r:r);

switch lower(char(shape))
    case 'square',  SE = true(n);
    case 'disk',    SE = x.^2 + y.^2 <= (r + 0.5)^2;
    case 'diamond', SE = abs(x) + abs(y) <= r;
    case 'cross',   SE = x == 0 | y == 0;
    case 'hline',   SE = y == 0;
    case 'vline',   SE = x == 0;
    otherwise
        error('ImageLab:invalidSE', ...
            'Unknown structuring element "%s". Use square, disk, diamond, cross, hline or vline.', shape);
end
end
